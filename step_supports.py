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
from build123d import Location, Solid, export_stl, import_step, offset


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


def find_overhang_faces(part: Solid, threshold: float = -0.5, verbose: bool = False):
    """Find faces whose normal points downward (overhang)."""
    overhang_faces = []

    for i, face in enumerate(part.faces()):
        center = face.center()
        normal = face.normal_at(center)

        if normal.Z < threshold:
            bb = face.bounding_box()

            # Skip bottom faces sitting on build plate
            if bb.max.Z < 0.5:
                if verbose:
                    print(f"    Face {i}: nz={normal.Z:.3f}, "
                          f"z={bb.min.Z:.1f}..{bb.max.Z:.1f} — SKIP (bottom)")
                continue

            overhang_faces.append((i, face, bb, normal))
            if verbose:
                print(f"    Face {i}: nz={normal.Z:.3f}, "
                      f"z={bb.min.Z:.1f}..{bb.max.Z:.1f}, area={face.area:.1f}")

    return overhang_faces


def compute_supports(
    part: Solid,
    margin: float = 0.2,
    min_volume: float = 1.0,
    stl_tolerance: float = 0.01,
    verbose: bool = False,
) -> trimesh.Trimesh | None:
    """Compute supports using STEP topology for face detection and trimesh for booleans."""
    t0 = time.time()

    # Offset model outward (provides the margin gap)
    if verbose:
        print("  Offsetting model...")
    inflated = offset(part, amount=margin)

    # Export inflated model to mesh for boolean operations
    with tempfile.NamedTemporaryFile(suffix=".stl") as tmp:
        export_stl(inflated, tmp.name, tolerance=stl_tolerance)
        inflated_mesh = trimesh.load(tmp.name)

    if verbose:
        print(f"  Offset done in {time.time() - t0:.1f}s")

    # Find overhang faces
    if verbose:
        print("  Finding overhang faces...")
    overhangs = find_overhang_faces(part, verbose=verbose)

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

        # Split into components and keep those above min_volume
        components = region.split(only_watertight=False)
        for comp in components:
            vol = abs(comp.volume)
            if vol >= min_volume:
                support_pieces.append(comp)

        if verbose:
            good = [c for c in components if abs(c.volume) >= min_volume]
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
        print(f"\nComputing supports (margin={args.margin}mm)...")
    supports = compute_supports(
        part,
        margin=args.margin,
        min_volume=args.min_volume,
        stl_tolerance=args.tolerance,
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
