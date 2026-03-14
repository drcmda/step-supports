#!/usr/bin/env python3
"""Generate 3D-print negative-space support structures from STEP files.

Uses B-Rep topology from STEP to identify overhang faces, then extracts
the negative space under each face via boolean operations.

Algorithm:
  1. Load STEP → offset solid outward by margin → export to mesh
  2. Compute full negative space (bounding box - inflated model)
  3. Clip negative space to model bounding box
  4. Find overhang faces (normal Z < threshold)
  5. Per face: extract region of negative space under the face's XY footprint
  6. Merge all support pieces, export as STL
"""

from __future__ import annotations

import argparse
import sys
import tempfile
import time

import numpy as np
import trimesh
from build123d import Kind, Location, Solid, export_stl, import_step, offset


def load_step(path: str, verbose: bool = False) -> tuple[Solid, float]:
    """Load a STEP file and translate so base sits at z=0."""
    part = import_step(path)

    if not isinstance(part, Solid):
        solids = part.solids()
        if solids:
            part = solids[0]
        else:
            raise ValueError(f"No solid geometry found in {path}")

    bb = part.bounding_box()
    z_min = bb.min.Z

    if abs(z_min) > 1e-6:
        part = part.moved(Location((0, 0, -z_min)))
        if verbose:
            print(f"  Translated z by {-z_min:.4f} to sit on build plate")

    bb = part.bounding_box()
    if verbose:
        print(f"  Loaded: {len(part.faces())} faces")
        print(f"  Bounds: ({bb.min.X:.1f}, {bb.min.Y:.1f}, {bb.min.Z:.1f}) -> "
              f"({bb.max.X:.1f}, {bb.max.Y:.1f}, {bb.max.Z:.1f})")

    return part, z_min


def find_overhang_faces(
    part: Solid,
    model_mesh: trimesh.Trimesh,
    angle: float = 45.0,
    verbose: bool = False,
):
    """Find faces that need support.

    A face needs support if:
      1. Its normal exceeds the overhang angle threshold (measured from
         horizontal — 45° means any downward-facing surface steeper than 45°), OR
      2. It starts mid-air: its lowest edge has no model material below it,
         so the first printed layers would have nothing to attach to.
    """
    import math

    # Convert angle from horizontal to normal-Z threshold.
    # 0° = horizontal (nz=-1), 45° = nz≈-0.707, 90° = vertical (nz=0)
    nz_threshold = -math.cos(math.radians(angle))

    overhang_faces = []

    for i, face in enumerate(part.faces()):
        center = face.center()
        normal = face.normal_at(center)
        bb = face.bounding_box()

        # Skip bottom faces sitting on build plate
        if bb.max.Z < 0.5:
            continue

        # Skip upward-facing faces (normal Z > 0 = top surface)
        if normal.Z >= 0:
            continue

        reason = None

        # Check 1: overhang angle
        if normal.Z < nz_threshold:
            reason = "overhang"
        # Check 2: mid-air — lowest point has no model below it
        elif bb.min.Z > 0.5:
            if _is_mid_air(face, bb, model_mesh):
                reason = "mid-air"

        if reason is None:
            continue

        overhang_faces.append((i, face, bb, normal))
        if verbose:
            deg = math.degrees(math.acos(-normal.Z))
            print(f"    Face {i}: nz={normal.Z:.3f} ({deg:.0f}°), "
                  f"z={bb.min.Z:.1f}..{bb.max.Z:.1f}, "
                  f"area={face.area:.1f}, {reason}")

    return overhang_faces


def _is_mid_air(face, fbb, model_mesh: trimesh.Trimesh, n_samples: int = 5) -> bool:
    """Check if a face starts mid-air by raycasting downward from its lowest edge.

    Samples points near the bottom of the face and casts rays downward.
    If none of them hit the model within a short distance below, the face
    is floating (mid-air) and needs support regardless of angle.
    """
    # Sample points near the bottom of the face's bounding box
    z_bottom = fbb.min.Z
    z_sample = z_bottom + 0.1  # just above the bottom edge

    # Create a grid of sample points within the face's XY footprint
    xs = np.linspace(fbb.min.X + 0.1, fbb.max.X - 0.1, min(n_samples, 3))
    ys = np.linspace(fbb.min.Y + 0.1, fbb.max.Y - 0.1, min(n_samples, 3))

    origins = []
    for x in xs:
        for y in ys:
            origins.append([x, y, z_sample])

    if not origins:
        return False

    origins = np.array(origins)
    directions = np.tile([0, 0, -1], (len(origins), 1))

    # Cast rays downward — if they hit the model, the face is supported
    hits = model_mesh.ray.intersects_any(origins, directions)

    # If most rays don't hit anything, the face is mid-air
    hit_ratio = hits.sum() / len(hits)
    return hit_ratio < 0.5


def _repair_mesh(mesh: trimesh.Trimesh) -> trimesh.Trimesh:
    """Remove degenerate faces and repair mesh to be watertight."""
    # Remove zero-area faces that break watertightness
    areas = mesh.area_faces
    good = areas > 1e-8
    if not good.all():
        mesh = trimesh.Trimesh(vertices=mesh.vertices, faces=mesh.faces[good])
        mesh.remove_unreferenced_vertices()

    trimesh.repair.fix_winding(mesh)
    trimesh.repair.fix_normals(mesh)
    trimesh.repair.fill_holes(mesh)
    return mesh


def _offset_to_mesh(
    part: Solid, margin: float, stl_tolerance: float, verbose: bool
) -> trimesh.Trimesh:
    """Offset the solid outward and return as a trimesh.

    Tries B-Rep offset with multiple kernel modes first. Falls back to
    vertex-normal inflation on the tessellated mesh if all B-Rep attempts fail.
    """
    # Try B-Rep offset with different kinds
    for kind in (Kind.ARC, Kind.INTERSECTION, Kind.TANGENT):
        try:
            inflated = offset(part, amount=margin, kind=kind)
            with tempfile.NamedTemporaryFile(suffix=".stl") as tmp:
                export_stl(inflated, tmp.name, tolerance=stl_tolerance)
                mesh = trimesh.load(tmp.name)
            mesh = _repair_mesh(mesh)
            if verbose:
                print(f"    B-Rep offset succeeded (kind={kind.name})")
            return mesh
        except Exception:
            continue

    # Fallback: tessellate, then inflate along vertex normals.
    # Vertex-normal inflation undershoots at sharp edges, so we subdivide
    # first and use 2x margin to compensate.
    print("  Warning: B-Rep offset failed — using mesh approximation, "
          "margin may be uneven near sharp edges")
    if verbose:
        print("    Tessellating model...")
    with tempfile.NamedTemporaryFile(suffix=".stl") as tmp:
        export_stl(part, tmp.name, tolerance=stl_tolerance)
        mesh = trimesh.load(tmp.name)

    mesh = _repair_mesh(mesh)

    # Subdivide to add vertices at edges where normals diverge most
    mesh = mesh.subdivide()

    # Use 2x margin to compensate for undershoot at convex edges
    mesh.vertices += mesh.vertex_normals * (margin * 2.0)

    mesh = _repair_mesh(mesh)
    return mesh


def compute_supports(
    part: Solid,
    margin: float = 0.2,
    min_volume: float = 1.0,
    stl_tolerance: float = 0.01,
    angle: float = 45.0,
    verbose: bool = False,
) -> trimesh.Trimesh | None:
    """Compute supports using STEP topology for face detection and trimesh for booleans."""
    t0 = time.time()

    # Offset model outward (provides the margin gap)
    if verbose:
        print("  Offsetting model...")
    inflated_mesh = _offset_to_mesh(part, margin, stl_tolerance, verbose)

    if verbose:
        print(f"  Offset done in {time.time() - t0:.1f}s")

    # Export non-inflated model mesh for mid-air raycasting
    with tempfile.NamedTemporaryFile(suffix=".stl") as tmp:
        export_stl(part, tmp.name, tolerance=stl_tolerance)
        model_mesh = _repair_mesh(trimesh.load(tmp.name))

    # Find overhang faces
    if verbose:
        print(f"  Finding overhang faces (angle={angle}°)...")
    overhangs = find_overhang_faces(
        part, model_mesh=model_mesh, angle=angle, verbose=verbose
    )

    if not overhangs:
        if verbose:
            print("  No overhang faces found")
        return None

    if verbose:
        print(f"  {len(overhangs)} overhang faces found")

    # Compute full negative space: outer_box - inflated, clipped to model bbox
    bb = part.bounding_box()
    pad = margin + 1.0
    outer_ext = [
        bb.max.X - bb.min.X + 2 * pad,
        bb.max.Y - bb.min.Y + 2 * pad,
        bb.max.Z + pad,
    ]
    cx = (bb.min.X + bb.max.X) / 2
    cy = (bb.min.Y + bb.max.Y) / 2

    outer_mesh = trimesh.creation.box(
        extents=outer_ext,
        transform=trimesh.transformations.translation_matrix(
            [cx, cy, outer_ext[2] / 2]
        ),
    )

    if verbose:
        print("  Computing negative space...")

    negative = trimesh.boolean.difference(
        [outer_mesh, inflated_mesh], engine="manifold"
    )

    # Clip to model bounding box (remove external wrapper)
    model_ext = [bb.max.X - bb.min.X, bb.max.Y - bb.min.Y, bb.max.Z]
    model_box = trimesh.creation.box(
        extents=model_ext,
        transform=trimesh.transformations.translation_matrix(
            [cx, cy, model_ext[2] / 2]
        ),
    )
    negative = trimesh.boolean.intersection(
        [negative, model_box], engine="manifold"
    )

    if negative is None or negative.is_empty:
        if verbose:
            print("  No negative space")
        return None

    if verbose:
        print(f"  Negative space: vol={negative.volume:.0f} mm³")

    # Extract support region under each overhang face
    support_pieces = []

    for idx, (face_id, face, fbb, normal) in enumerate(overhangs):
        if verbose:
            print(f"  Extracting face {face_id} ({idx + 1}/{len(overhangs)})...")

        # Create vertical column matching face's XY bounding box
        fx = fbb.max.X - fbb.min.X + 0.1
        fy = fbb.max.Y - fbb.min.Y + 0.1
        fz = fbb.max.Z + 1.0
        fcx = (fbb.min.X + fbb.max.X) / 2
        fcy = (fbb.min.Y + fbb.max.Y) / 2

        column = trimesh.creation.box(
            extents=[fx, fy, fz],
            transform=trimesh.transformations.translation_matrix(
                [fcx, fcy, fz / 2]
            ),
        )

        try:
            region = trimesh.boolean.intersection(
                [negative, column], engine="manifold"
            )
        except Exception as e:
            if verbose:
                print(f"    Failed: {e}")
            continue

        if region is None or region.is_empty:
            if verbose:
                print(f"    No region")
            continue

        # Split into components, filter by volume.
        # Discard pieces entirely ABOVE the face (strays captured by the
        # XY column). Pieces below are legitimate supports reaching down.
        components = region.split(only_watertight=False)
        good = []
        for comp in components:
            vol = abs(comp.volume)
            if vol < min_volume:
                continue
            comp_z_min = comp.bounds[0][2]
            if comp_z_min > fbb.max.Z + margin:
                if verbose:
                    comp_z_max = comp.bounds[1][2]
                    print(f"    Discarded stray: vol={vol:.0f}, "
                          f"z={comp_z_min:.1f}..{comp_z_max:.1f}")
                continue
            good.append(comp)
        support_pieces.extend(good)

        if verbose:
            total = sum(abs(c.volume) for c in good)
            print(f"    {len(good)} pieces, vol={total:.0f} mm³")

    if not support_pieces:
        if verbose:
            print("  No supports after filtering")
        return None

    # Merge all pieces
    supports = trimesh.util.concatenate(support_pieces)

    elapsed = time.time() - t0
    if verbose:
        print(f"  Done in {elapsed:.1f}s — {len(support_pieces)} pieces, "
              f"{len(supports.faces)} faces, "
              f"vol = {abs(supports.volume):.1f} mm³")

    return supports


def main():
    parser = argparse.ArgumentParser(
        description="Generate negative-space 3D print supports from STEP files."
    )
    parser.add_argument("input", help="Path to input STEP file")
    parser.add_argument(
        "-o", "--output",
        help="Output STL path (default: INPUT_supports.stl)",
    )
    parser.add_argument(
        "-m", "--margin",
        type=float, default=0.2,
        help="Gap between support and model in mm (default: 0.2)",
    )
    parser.add_argument(
        "--min-volume",
        type=float, default=1.0,
        help="Discard support components smaller than this in mm³ (default: 1.0)",
    )
    parser.add_argument(
        "--tolerance",
        type=float, default=0.01,
        help="STL export tolerance in mm (default: 0.01)",
    )
    parser.add_argument(
        "-a", "--angle",
        type=float, default=45.0,
        help="Overhang angle threshold in degrees from horizontal (default: 45). "
             "Faces steeper than this get supports. Mid-air faces are always supported.",
    )
    parser.add_argument(
        "-e", "--export-model",
        action="store_true",
        help="Also export the input STEP model as STL",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Print progress information",
    )

    args = parser.parse_args()

    if args.output is None:
        stem = args.input.rsplit(".", 1)[0]
        args.output = f"{stem}_supports.stl"

    if args.verbose:
        print(f"Loading {args.input}...")
    part, original_z_min = load_step(args.input, verbose=args.verbose)

    if args.verbose:
        print(f"\nComputing supports (margin={args.margin}mm, angle={args.angle}°)...")
    supports = compute_supports(
        part,
        margin=args.margin,
        min_volume=args.min_volume,
        stl_tolerance=args.tolerance,
        angle=args.angle,
        verbose=args.verbose,
    )

    if supports is None:
        print("No supports generated.", file=sys.stderr)
        sys.exit(1)

    # Translate supports back to original coordinate space
    if abs(original_z_min) > 1e-6:
        supports.apply_translation([0, 0, original_z_min])
        if args.verbose:
            print(f"  Translated supports back by z={original_z_min:.4f}")

    supports.export(args.output)
    print(f"Supports written to {args.output}")
    print(f"  {len(supports.faces)} faces, volume = {abs(supports.volume):.1f} mm³")

    if args.export_model:
        model_stl = args.input.rsplit(".", 1)[0] + ".stl"
        export_stl(part.moved(Location((0, 0, original_z_min))),
                   model_stl, tolerance=args.tolerance)
        print(f"Model written to {model_stl}")


if __name__ == "__main__":
    main()
