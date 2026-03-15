#!/usr/bin/env python3
"""Generate 3D-print negative-space support structures from STEP or mesh files.

STEP input uses B-Rep topology to identify overhang faces, then extracts
the negative space under each face via boolean operations.

Mesh input (STL/OBJ/PLY/3MF) generates full-shell supports — the entire
negative space around the model. No overhang detection (no B-Rep topology),
so all surfaces get support. Uses more material but works with any mesh format.

Algorithm (STEP):
  1. Load STEP -> tessellate model to mesh
  2. Inflate model mesh outward by margin (Minkowski sum with sphere)
  3. Compute full negative space (bounding box - inflated model)
  4. Find overhang faces (normal Z < threshold)
  5. Per face: extract region of negative space under the face's XY footprint
  6. Merge all support pieces, export as STL

Algorithm (mesh):
  1. Load mesh directly
  2. Inflate mesh outward by margin (Minkowski sum with sphere)
  3. Compute full negative space (bounding box - inflated model)
  4. Split into pieces, filter small fragments
  5. Merge and export as STL
"""

from __future__ import annotations

import argparse
import math
import os
import sys
import tempfile
import time
import warnings

import numpy as np
import trimesh

from negative_support.progress import ProgressDisplay

# build123d is only needed for STEP input (B-Rep overhang detection).
# Defer import so mesh-only usage works without it installed.
try:
    from build123d import Location, Solid, export_stl, import_step
    _HAS_BUILD123D = True
except ImportError:
    _HAS_BUILD123D = False

# File extensions that trigger the STEP pipeline (B-Rep overhang detection)
STEP_EXTENSIONS = {".step", ".stp"}


# -- Loading --

def load_step(path: str, verbose: bool = False) -> tuple:
    """Load a STEP file and translate so base sits at z=0."""
    if not _HAS_BUILD123D:
        raise ImportError(
            "build123d is required for STEP files. "
            "Install it with: pip install negative-support[step]"
        )
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


def load_mesh(path: str, verbose: bool = False) -> tuple[trimesh.Trimesh, float]:
    """Load a mesh file (STL/OBJ/PLY/3MF/etc.) and translate so base sits at z=0."""
    mesh = trimesh.load(path)
    if isinstance(mesh, trimesh.Scene):
        # Multi-body mesh: combine all geometries
        mesh = trimesh.util.concatenate(list(mesh.geometry.values()))
    mesh = _repair_mesh(mesh)

    z_min = float(mesh.bounds[0][2])
    if abs(z_min) > 1e-6:
        mesh.apply_translation([0, 0, -z_min])
        if verbose:
            print(f"  Translated z by {-z_min:.4f} to sit on build plate")

    if verbose:
        print(f"  Loaded: {len(mesh.faces):,} faces")
        bounds = mesh.bounds
        print(f"  Bounds: ({bounds[0][0]:.1f}, {bounds[0][1]:.1f}, {bounds[0][2]:.1f}) -> "
              f"({bounds[1][0]:.1f}, {bounds[1][1]:.1f}, {bounds[1][2]:.1f})")

    return mesh, z_min


# -- Overhang detection (STEP only) --

def find_overhang_faces(
    part,
    model_mesh: trimesh.Trimesh,
    angle: float = 45.0,
    verbose: bool = False,
):
    """Find faces that need support.

    A face needs support if:
      1. Its normal exceeds the overhang angle threshold (measured from
         horizontal), OR
      2. It starts mid-air: its lowest edge has no model material below it.

    For curved faces, normals are sampled across the surface since the
    overhang angle varies.
    """
    nz_threshold = -math.cos(math.radians(angle))

    mid_air_min_angle = max(angle - 2.0, 0.0)
    nz_midair_steep = -math.cos(math.radians(mid_air_min_angle))
    mid_air_max_angle = min(angle + 25.0, 80.0)
    nz_midair_limit = -math.cos(math.radians(mid_air_max_angle))

    overhang_faces = []

    for i, face in enumerate(part.faces()):
        bb = face.bounding_box()

        if bb.max.Z < 0.5:
            continue

        center = face.center()
        center_normal = face.normal_at(center)

        is_planar = str(face.geom_type) == "GeomType.PLANE"
        min_nz = center_normal.Z
        extract_bb = bb

        if not is_planar:
            try:
                tess = face.tessellate(0.1)
                if tess and len(tess) >= 1:
                    verts = tess[0]
                    overhang_verts = []
                    for v in verts:
                        try:
                            n = face.normal_at(v)
                            if n.Z < min_nz:
                                min_nz = n.Z
                            if n.Z < nz_threshold:
                                overhang_verts.append((v.X, v.Y, v.Z))
                        except Exception:
                            pass

                    if overhang_verts:
                        ovh = np.array(overhang_verts)
                        from types import SimpleNamespace

                        tight_min = SimpleNamespace(
                            X=float(ovh[:, 0].min()),
                            Y=float(ovh[:, 1].min()),
                            Z=float(ovh[:, 2].min()),
                        )
                        tight_max = SimpleNamespace(
                            X=float(ovh[:, 0].max()),
                            Y=float(ovh[:, 1].max()),
                            Z=float(ovh[:, 2].max()),
                        )
                        extract_bb = SimpleNamespace(min=tight_min, max=tight_max)
            except Exception:
                pass

        if min_nz >= 0:
            continue

        reason = None

        if min_nz < nz_threshold:
            reason = "overhang"
        elif min_nz < nz_midair_steep and min_nz < nz_midair_limit and bb.min.Z > 0.5:
            if _is_mid_air(face, bb, model_mesh):
                reason = "mid-air"

        if reason is None:
            continue

        overhang_faces.append((i, face, extract_bb, center_normal))
        if verbose:
            deg = math.degrees(math.acos(min(-min_nz, 1.0)))
            extra = ""
            if not is_planar and extract_bb is not bb:
                extra = (f" [tight X={extract_bb.min.X:.1f}..{extract_bb.max.X:.1f},"
                         f" Y={extract_bb.min.Y:.1f}..{extract_bb.max.Y:.1f}]")
            print(f"    Face {i}: nz={min_nz:.3f} ({deg:.0f}\u00b0), "
                  f"z={bb.min.Z:.1f}..{bb.max.Z:.1f}, "
                  f"area={face.area:.1f}, {reason}{extra}")

    return overhang_faces


def _is_mid_air(face, fbb, model_mesh: trimesh.Trimesh, n_samples: int = 5) -> bool:
    """Check if a face starts mid-air by raycasting downward from its lowest edge."""
    z_bottom = fbb.min.Z
    z_sample = z_bottom + 0.1

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

    hits = model_mesh.ray.intersects_any(origins, directions)
    hit_ratio = hits.sum() / len(hits)
    return hit_ratio < 0.5


# -- Mesh utilities --

def _repair_mesh(mesh: trimesh.Trimesh) -> trimesh.Trimesh:
    """Remove degenerate faces and repair mesh to be watertight."""
    areas = mesh.area_faces
    good = areas > 1e-8
    if not good.all():
        mesh = trimesh.Trimesh(vertices=mesh.vertices, faces=mesh.faces[good])
        mesh.remove_unreferenced_vertices()

    trimesh.repair.fix_winding(mesh)
    trimesh.repair.fix_normals(mesh)
    trimesh.repair.fill_holes(mesh)
    return mesh


def _to_manifold(mesh: trimesh.Trimesh):
    """Convert trimesh to manifold3d Manifold, forcing valid topology."""
    import manifold3d
    m3d_mesh = manifold3d.Mesh(
        vert_properties=np.array(mesh.vertices, dtype=np.float32),
        tri_verts=np.array(mesh.faces, dtype=np.uint32),
    )
    return manifold3d.Manifold(m3d_mesh)


def _from_manifold(manifold_obj) -> trimesh.Trimesh:
    """Convert manifold3d Manifold back to trimesh."""
    out = manifold_obj.to_mesh()
    return trimesh.Trimesh(
        vertices=out.vert_properties[:, :3],
        faces=out.tri_verts,
    )


def _manifold_boolean(
    a: trimesh.Trimesh, b: trimesh.Trimesh, op: str
) -> trimesh.Trimesh:
    """Perform boolean using manifold3d directly."""
    import manifold3d
    ma = _to_manifold(a)
    mb = _to_manifold(b)
    op_map = {
        "difference": manifold3d.OpType.Subtract,
        "intersection": manifold3d.OpType.Intersect,
        "union": manifold3d.OpType.Add,
    }
    if op not in op_map:
        raise ValueError(f"Unknown op: {op}")
    result = manifold3d.Manifold.batch_boolean([ma, mb], op_map[op])
    return _from_manifold(result)


def _model_to_mesh(part, stl_tolerance: float) -> trimesh.Trimesh:
    """Tessellate the STEP solid to a trimesh."""
    with tempfile.NamedTemporaryFile(suffix=".stl") as tmp:
        export_stl(part, tmp.name, tolerance=stl_tolerance)
        mesh = trimesh.load(tmp.name)
    return _repair_mesh(mesh)


# -- Bounding box helpers --

def _bbox_from_part(part) -> tuple[np.ndarray, np.ndarray]:
    """Extract (min_corner, max_corner) from a build123d Solid bounding box."""
    bb = part.bounding_box()
    return (
        np.array([bb.min.X, bb.min.Y, bb.min.Z]),
        np.array([bb.max.X, bb.max.Y, bb.max.Z]),
    )


def _bbox_from_mesh(mesh: trimesh.Trimesh) -> tuple[np.ndarray, np.ndarray]:
    """Extract (min_corner, max_corner) from a trimesh."""
    return mesh.bounds[0].copy(), mesh.bounds[1].copy()


def _compute_negative_mesh(bbox_min, bbox_max, inflated_mesh, margin):
    """Compute negative space: outer box - inflated model, clipped to model bbox."""
    pad = margin + 1.0
    outer_ext = [
        bbox_max[0] - bbox_min[0] + 2 * pad,
        bbox_max[1] - bbox_min[1] + 2 * pad,
        bbox_max[2] + pad,
    ]
    cx = (bbox_min[0] + bbox_max[0]) / 2
    cy = (bbox_min[1] + bbox_max[1]) / 2

    outer_mesh = trimesh.creation.box(
        extents=outer_ext,
        transform=trimesh.transformations.translation_matrix(
            [cx, cy, outer_ext[2] / 2]
        ),
    )
    negative = _manifold_boolean(outer_mesh, inflated_mesh, "difference")

    model_ext = [bbox_max[0] - bbox_min[0], bbox_max[1] - bbox_min[1], bbox_max[2]]
    model_box = trimesh.creation.box(
        extents=model_ext,
        transform=trimesh.transformations.translation_matrix(
            [cx, cy, model_ext[2] / 2]
        ),
    )
    return _manifold_boolean(negative, model_box, "intersection")


# -- Support computation --

def compute_supports(
    part,
    margin: float = 0.2,
    min_volume: float = 1.0,
    stl_tolerance: float = 0.01,
    angle: float = 45.0,
    verbose: bool = False,
    debug: bool = False,
) -> trimesh.Trimesh | None:
    """Compute supports using STEP topology for face detection and trimesh for booleans."""
    progress = ProgressDisplay(enabled=verbose)
    t0 = time.time()

    # Step 1: Tessellate
    progress.start_step("Tessellate")
    model_mesh = _model_to_mesh(part, stl_tolerance)
    progress.finish_step(f"{len(model_mesh.faces):,} faces")

    # Step 2: Inflate
    progress.start_step("Inflate")
    import manifold3d
    model_man = _to_manifold(model_mesh)
    sphere = manifold3d.Manifold.sphere(margin, 16)
    inflated_man = model_man.minkowski_sum(sphere)
    inflated_mesh = _from_manifold(inflated_man)
    progress.finish_step(f"{len(inflated_mesh.faces):,} faces")

    # Step 3: Negative space
    bbox_min, bbox_max = _bbox_from_part(part)
    progress.start_step("Negative space")
    try:
        negative_mesh = _compute_negative_mesh(bbox_min, bbox_max, inflated_mesh, margin)
        if negative_mesh is None or negative_mesh.is_empty:
            raise ValueError("empty negative space")
        progress.finish_step(f"{negative_mesh.volume:,.0f} mm\u00b3")
    except Exception as e:
        progress.fail_step(str(e))
        print(f"\nError: mesh boolean failed for this model ({e}).")
        print("The model's tessellation is non-manifold and cannot be")
        print("used for support generation. Try repairing the STEP model")
        print("in your CAD software.")
        return None

    # Step 4: Detect overhangs
    progress.start_step("Detect overhangs")
    overhangs = find_overhang_faces(
        part, model_mesh=model_mesh, angle=angle, verbose=debug
    )
    if not overhangs:
        progress.finish_step("none found")
        return None
    progress.finish_step(f"{len(overhangs)} faces")

    # Suppress trimesh warnings about degenerate triangles during extraction
    warnings.filterwarnings("ignore", category=RuntimeWarning, module="trimesh")

    # Step 5: Extract supports
    progress.start_step("Extract supports")
    support_pieces = []
    n_overhangs = len(overhangs)

    for idx, (face_id, face, fbb, normal) in enumerate(overhangs):
        progress.update_progress(idx + 1, n_overhangs)

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
            region = _manifold_boolean(negative_mesh, column, "intersection")
        except Exception:
            continue

        if region is None or region.is_empty:
            continue

        components = region.split(only_watertight=False)
        for comp in components:
            vol = abs(comp.volume)
            if vol < min_volume:
                continue
            comp_z_min = comp.bounds[0][2]
            if comp_z_min > fbb.max.Z + margin:
                if debug:
                    comp_z_max = comp.bounds[1][2]
                    print(f"    Discarded stray: vol={vol:.0f}, "
                          f"z={comp_z_min:.1f}..{comp_z_max:.1f}")
                continue
            support_pieces.append(comp)

    if not support_pieces:
        progress.finish_step("none")
        return None
    progress.finish_step(f"{len(support_pieces)} pieces")

    # Step 6: Merge
    progress.start_step("Merge")
    supports = trimesh.util.concatenate(support_pieces)
    progress.finish_step(f"{len(supports.faces):,} faces")

    elapsed = time.time() - t0
    if verbose and not debug:
        vol = abs(supports.volume)
        print(f"\n  Done in {elapsed:.1f}s \u2014 {len(support_pieces)} pieces, "
              f"{vol:,.1f} mm\u00b3")

    return supports


def compute_supports_mesh(
    model_mesh: trimesh.Trimesh,
    margin: float = 0.2,
    min_volume: float = 1.0,
    verbose: bool = False,
) -> trimesh.Trimesh | None:
    """Compute full-shell supports from a mesh (no B-Rep overhang detection)."""
    progress = ProgressDisplay(enabled=verbose)
    t0 = time.time()

    # Step 1: Inflate
    progress.start_step("Inflate")
    import manifold3d
    model_man = _to_manifold(model_mesh)
    sphere = manifold3d.Manifold.sphere(margin, 16)
    inflated_man = model_man.minkowski_sum(sphere)
    inflated_mesh = _from_manifold(inflated_man)
    progress.finish_step(f"{len(inflated_mesh.faces):,} faces")

    # Step 2: Negative space
    bbox_min, bbox_max = _bbox_from_mesh(model_mesh)
    progress.start_step("Negative space")
    try:
        negative_mesh = _compute_negative_mesh(bbox_min, bbox_max, inflated_mesh, margin)
        if negative_mesh is None or negative_mesh.is_empty:
            raise ValueError("empty negative space")
        progress.finish_step(f"{negative_mesh.volume:,.0f} mm\u00b3")
    except Exception as e:
        progress.fail_step(str(e))
        print(f"\nError: mesh boolean failed for this model ({e}).")
        print("The model mesh may be non-manifold. Try repairing it")
        print("in your modeling software or with trimesh/meshlab.")
        return None

    warnings.filterwarnings("ignore", category=RuntimeWarning, module="trimesh")

    # Step 3: Split & filter
    progress.start_step("Split & filter")
    components = negative_mesh.split(only_watertight=False)
    support_pieces = []
    for comp in components:
        vol = abs(comp.volume)
        if vol >= min_volume:
            support_pieces.append(comp)

    if not support_pieces:
        progress.finish_step("none")
        return None
    progress.finish_step(f"{len(support_pieces)} pieces")

    # Step 4: Merge
    progress.start_step("Merge")
    supports = trimesh.util.concatenate(support_pieces)
    progress.finish_step(f"{len(supports.faces):,} faces")

    elapsed = time.time() - t0
    if verbose:
        vol = abs(supports.volume)
        print(f"\n  Done in {elapsed:.1f}s \u2014 {len(support_pieces)} pieces, "
              f"{vol:,.1f} mm\u00b3")

    return supports


# -- CLI entry point --

def main():
    from negative_support import __version__
    from negative_support.license import (
        activate_token,
        check_license,
        get_status,
        open_buy_page,
        print_buy_message,
    )

    parser = argparse.ArgumentParser(
        description="Generate negative-space 3D print supports from STEP or mesh files."
    )
    parser.add_argument(
        "input", nargs="?",
        help="Path to input file (STEP/STP for overhang detection, "
             "STL/OBJ/PLY/3MF for full-shell supports)",
    )
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
        help="Discard support components smaller than this in mm\u00b3 (default: 1.0)",
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
        "-q", "--quiet",
        action="store_true",
        help="Suppress progress display",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Print detailed per-face diagnostics",
    )

    # License management flags
    parser.add_argument(
        "--version",
        action="version",
        version=f"negative-support {__version__}",
    )
    parser.add_argument(
        "--buy",
        action="store_true",
        help="Open the purchase page in your browser",
    )
    parser.add_argument(
        "--activate",
        metavar="TOKEN",
        help="Activate a license token",
    )
    parser.add_argument(
        "--status",
        action="store_true",
        help="Show license status",
    )

    args = parser.parse_args()

    # Handle license management commands (no input file needed)
    if args.buy:
        open_buy_page()
        return

    if args.activate:
        ok, msg = activate_token(args.activate)
        print(msg)
        sys.exit(0 if ok else 1)

    if args.status:
        print(get_status())
        return

    # Require input file for support generation
    if args.input is None:
        parser.print_help()
        sys.exit(1)

    # Check license before doing any work
    if os.environ.get("NS_DEV"):
        allowed, lic_msg = True, "Dev mode"
    else:
        allowed, lic_msg = check_license()
        if not allowed:
            print_buy_message()
            sys.exit(1)

    if args.output is None:
        stem = args.input.rsplit(".", 1)[0]
        args.output = f"{stem}_supports.stl"

    show_progress = not args.quiet or args.debug

    # Show license status briefly
    if show_progress and lic_msg:
        print(f"  {lic_msg}")

    # Detect input format by extension
    ext = os.path.splitext(args.input)[1].lower()
    is_step = ext in STEP_EXTENSIONS

    if is_step:
        # STEP pipeline: B-Rep overhang detection
        if show_progress:
            print(f"Loading {args.input}...")
        part, original_z_min = load_step(args.input, verbose=show_progress)

        if show_progress:
            print(f"\nComputing supports (margin={args.margin}mm, angle={args.angle}\u00b0)...")
        supports = compute_supports(
            part,
            margin=args.margin,
            min_volume=args.min_volume,
            stl_tolerance=args.tolerance,
            angle=args.angle,
            verbose=show_progress,
            debug=args.debug,
        )
    else:
        # Mesh pipeline: full-shell supports (no overhang detection)
        if show_progress:
            print(f"Loading {args.input} (mesh mode \u2014 full-shell supports)...")
        model_mesh, original_z_min = load_mesh(args.input, verbose=show_progress)

        if show_progress:
            print(f"\nComputing full-shell supports (margin={args.margin}mm)...")
        supports = compute_supports_mesh(
            model_mesh,
            margin=args.margin,
            min_volume=args.min_volume,
            verbose=show_progress,
        )

    if supports is None:
        print("No supports generated.", file=sys.stdout)
        sys.exit(1)

    # Translate supports back to original coordinate space
    if abs(original_z_min) > 1e-6:
        supports.apply_translation([0, 0, original_z_min])

    supports.export(args.output)
    print(f"Supports written to {args.output}")
    print(f"  {len(supports.faces)} faces, volume = {abs(supports.volume):.1f} mm\u00b3")

    if args.export_model and is_step:
        model_stl = args.input.rsplit(".", 1)[0] + ".stl"
        export_stl(part.moved(Location((0, 0, original_z_min))),
                   model_stl, tolerance=args.tolerance)
        print(f"Model written to {model_stl}")


if __name__ == "__main__":
    main()
