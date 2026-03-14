#!/usr/bin/env python3
"""Generate 3D-print negative-space support structures for STL files.

Algorithm:
  1. Create padded bounding box around the model
  2. Subtract inflated model → full negative space
  3. Intersect with model bbox → remove external wrapper
  4. Split into components, filter by volume
"""

from __future__ import annotations

import argparse
import sys
import time

import numpy as np
import trimesh


def load_mesh(path, verbose=False):
    """Load an STL file, flatten scenes, move base to z=0."""
    raw = trimesh.load(path)

    if isinstance(raw, trimesh.Scene):
        mesh = raw.dump(concatenate=True)
        if verbose:
            print(f"  Flattened scene with {len(raw.geometry)} geometries")
    else:
        mesh = raw

    if not isinstance(mesh, trimesh.Trimesh):
        raise ValueError(f"Could not load a triangle mesh from {path}")

    trimesh.repair.fix_winding(mesh)
    trimesh.repair.fix_normals(mesh)
    trimesh.repair.fill_holes(mesh)

    if verbose:
        print(f"  Loaded: {len(mesh.faces)} faces, {len(mesh.vertices)} vertices")
        print(f"  Watertight: {mesh.is_watertight}")
        print(f"  Bounds: {mesh.bounds[0]} -> {mesh.bounds[1]}")

    z_min = mesh.bounds[0][2]
    if abs(z_min) > 1e-6:
        mesh.apply_translation([0, 0, -z_min])
        if verbose:
            print(f"  Translated z by {-z_min:.4f} to sit on build plate")

    return mesh, z_min


def inflate_mesh(mesh, margin):
    """Offset mesh outward along vertex normals."""
    inflated = mesh.copy()
    inflated.vertices += inflated.vertex_normals * margin
    inflated.fix_normals()
    return inflated


def compute_supports(mesh, margin=0.2, min_volume=1.0, verbose=False):
    """Compute negative-space supports via box - inflated model.

    1. Padded bounding box - inflated model = full negative space
    2. Intersect with model bbox to remove external wrapper
    3. Split into components, keep those above min_volume
    """
    t0 = time.time()

    inflated = inflate_mesh(mesh, margin)

    bounds = mesh.bounds
    pad = margin + 1.0

    # Padded outer box
    box_min = bounds[0] - [pad, pad, 0]
    box_max = bounds[1] + [pad, pad, pad]
    box_center = (box_min + box_max) / 2
    box_extents = box_max - box_min

    outer = trimesh.creation.box(
        extents=box_extents,
        transform=trimesh.transformations.translation_matrix(box_center),
    )

    if verbose:
        print(f"  Outer box: {box_extents}")

    # Boolean: box - inflated
    try:
        negative = trimesh.boolean.difference(
            [outer, inflated], engine="manifold"
        )
    except Exception as e:
        if verbose:
            print(f"  Boolean failed: {e}")
        return None

    if negative is None or negative.is_empty:
        if verbose:
            print("  No negative space")
        return None

    # Intersect with model bounding box to clip external space
    model_center = (bounds[0] + bounds[1]) / 2
    model_extents = bounds[1] - bounds[0]
    model_box = trimesh.creation.box(
        extents=model_extents,
        transform=trimesh.transformations.translation_matrix(model_center),
    )

    try:
        clipped = trimesh.boolean.intersection(
            [negative, model_box], engine="manifold"
        )
    except Exception as e:
        if verbose:
            print(f"  Intersection failed: {e}")
        return None

    if clipped is None or clipped.is_empty:
        if verbose:
            print("  No clipped result")
        return None

    # Split into components
    components = clipped.split(only_watertight=False)

    if verbose:
        vols = sorted([abs(c.volume) for c in components], reverse=True)
        print(f"  {len(components)} components, volumes: "
              f"{', '.join(f'{v:.0f}' for v in vols[:10])}")

    # Keep all components above min_volume
    all_supports = []
    for i, comp in enumerate(components):
        vol = abs(comp.volume)
        if vol < min_volume:
            continue
        all_supports.append(comp)
        if verbose:
            b = comp.bounds
            print(f"    Component {i}: vol={vol:.1f} mm³, "
                  f"z={b[0][2]:.1f}..{b[1][2]:.1f}")

    if not all_supports:
        if verbose:
            print("  No supports after filtering")
        return None

    supports = trimesh.util.concatenate(all_supports)

    elapsed = time.time() - t0
    if verbose:
        print(f"  Done in {elapsed:.1f}s — {len(all_supports)} pieces, "
              f"{len(supports.faces)} faces, "
              f"vol = {abs(supports.volume):.1f} mm³")

    return supports


def main():
    parser = argparse.ArgumentParser(
        description="Generate negative-space 3D print supports for STL files."
    )
    parser.add_argument("input", help="Path to input STL file")
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
    mesh, original_z_min = load_mesh(args.input, verbose=args.verbose)

    if args.verbose:
        print(f"\nComputing supports (margin={args.margin}mm)...")
    supports = compute_supports(
        mesh,
        margin=args.margin,
        min_volume=args.min_volume,
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


if __name__ == "__main__":
    main()
