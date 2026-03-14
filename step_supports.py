#!/usr/bin/env python3
"""Generate 3D-print negative-space support structures from STEP or mesh files.

STEP input uses B-Rep topology to identify overhang faces, then extracts
the negative space under each face via boolean operations.

Mesh input (STL/OBJ/PLY/3MF) generates full-shell supports — the entire
negative space around the model. No overhang detection (no B-Rep topology),
so all surfaces get support. Uses more material but works with any mesh format.

Algorithm (STEP):
  1. Load STEP → tessellate model to mesh
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
import sys
import tempfile
import threading
import time
import warnings

import numpy as np
import trimesh

# build123d is only needed for STEP input (B-Rep overhang detection).
# Defer import so mesh-only usage works without it installed.
try:
    from build123d import Location, Solid, export_stl, import_step
    _HAS_BUILD123D = True
except ImportError:
    _HAS_BUILD123D = False


# ── Progress display ───────────────────────────────────────────────────

SPINNER_FRAMES = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"
BAR_WIDTH = 20


class ProgressDisplay:
    """Multi-step pipeline progress with spinner and progress bar.

    Each step is rendered on a single line. The active step updates
    in-place using carriage return (\\r). When a step completes, its line
    is finalised and the next step starts on a new line. This avoids
    fragile multi-line ANSI cursor movement.

    Falls back to simple line-by-line output when stdout is not a TTY.
    """

    def __init__(self, enabled: bool = True):
        self._tty = sys.stdout.isatty()
        self._enabled = enabled
        self._use_color = self._tty
        self._step_start: float | None = None
        self._step_name: str = ""
        self._progress: tuple[int, int] | None = None
        self._spinner_idx = 0
        self._spinner_thread: threading.Thread | None = None
        self._spinner_stop = threading.Event()
        self._lock = threading.Lock()
        self._line_open = False  # True if current line needs \r to overwrite

    # ── public API ──────────────────────────────────────────────────

    def start_step(self, name: str) -> None:
        if not self._enabled:
            return
        with self._lock:
            self._step_name = name
            self._step_start = time.time()
            self._progress = None
            self._spinner_idx = 0
        self._start_spinner()

    def finish_step(self, detail: str = "") -> None:
        if not self._enabled:
            return
        self._stop_spinner()
        with self._lock:
            elapsed = time.time() - self._step_start if self._step_start else 0
            self._progress = None
            line = self._format_done(self._step_name, detail, elapsed)
            self._write_final(line)

    def fail_step(self, detail: str = "") -> None:
        if not self._enabled:
            return
        self._stop_spinner()
        with self._lock:
            elapsed = time.time() - self._step_start if self._step_start else 0
            sym = self._red("✗")
            detail_str = self._red(detail) if detail else ""
            time_str = self._dim(f"{elapsed:>5.1f}s")
            line = f"  {sym} {self._step_name:<20s}{detail_str:<27s}{time_str}"
            self._write_final(line)

    def update_progress(self, current: int, total: int) -> None:
        if not self._enabled:
            return
        with self._lock:
            self._progress = (current, total)

    # ── rendering ───────────────────────────────────────────────────

    def _render_active(self) -> None:
        """Render the active step line in-place (called by spinner thread)."""
        with self._lock:
            elapsed = time.time() - self._step_start if self._step_start else 0
            frame = SPINNER_FRAMES[self._spinner_idx % len(SPINNER_FRAMES)]
            sym = self._cyan(frame)
            name_str = f"{self._step_name:<20s}"
            time_str = self._dim(f"{elapsed:>5.1f}s")

            if self._progress and self._progress[1] > 0:
                cur, tot = self._progress
                pct = cur / tot
                filled = int(pct * BAR_WIDTH)
                bar = self._cyan("█" * filled) + self._dim("░" * (BAR_WIDTH - filled))
                pct_str = f"{pct * 100:>3.0f}%"
                line = f"  {sym} {name_str}{bar} {pct_str}  {time_str}"
            else:
                line = f"  {sym} {name_str}{'':<27s}{time_str}"

            if self._tty:
                sys.stdout.write(f"\r\033[2K{line}")
                sys.stdout.flush()
                self._line_open = True

    def _write_final(self, line: str) -> None:
        """Write a completed step line (permanent, not overwritten)."""
        if self._tty and self._line_open:
            sys.stdout.write(f"\r\033[2K{line}\n")
        else:
            sys.stdout.write(f"{line}\n")
        sys.stdout.flush()
        self._line_open = False

    def _format_done(self, name: str, detail: str, elapsed: float) -> str:
        sym = self._green("✓")
        time_str = self._dim(f"{elapsed:>5.1f}s")
        detail_str = self._dim(detail) if detail else ""
        return f"  {sym} {name:<20s}{detail_str:<27s}{time_str}"

    # ── spinner thread ──────────────────────────────────────────────

    def _start_spinner(self) -> None:
        self._stop_spinner()
        self._spinner_stop.clear()
        self._spinner_thread = threading.Thread(target=self._spinner_loop, daemon=True)
        self._spinner_thread.start()

    def _stop_spinner(self) -> None:
        if self._spinner_thread and self._spinner_thread.is_alive():
            self._spinner_stop.set()
            self._spinner_thread.join(timeout=1)
            self._spinner_thread = None

    def _spinner_loop(self) -> None:
        while not self._spinner_stop.is_set():
            with self._lock:
                self._spinner_idx += 1
            self._render_active()
            self._spinner_stop.wait(0.1)

    # ── ANSI helpers ────────────────────────────────────────────────

    def _green(self, s: str) -> str:
        return f"\033[32m{s}\033[0m" if self._use_color else s

    def _red(self, s: str) -> str:
        return f"\033[31m{s}\033[0m" if self._use_color else s

    def _cyan(self, s: str) -> str:
        return f"\033[36m{s}\033[0m" if self._use_color else s

    def _dim(self, s: str) -> str:
        return f"\033[2m{s}\033[0m" if self._use_color else s


def load_step(path: str, verbose: bool = False) -> tuple:
    """Load a STEP file and translate so base sits at z=0."""
    if not _HAS_BUILD123D:
        raise ImportError(
            "build123d is required for STEP files. Install it with: pip install build123d"
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


# File extensions that trigger the STEP pipeline (B-Rep overhang detection)
STEP_EXTENSIONS = {".step", ".stp"}


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

    For curved faces (cylinders, etc.), normals are sampled across the surface
    since the overhang angle varies. Only the overhanging portion is used
    for the extraction column bounding box.
    """
    # Convert angle from horizontal to normal-Z threshold.
    # 0° = horizontal (nz=-1), 45° = nz≈-0.707, 90° = vertical (nz=0)
    nz_threshold = -math.cos(math.radians(angle))

    # Mid-air detection bounds:
    # - Lower bound: faces must be at least 2° steeper than the overhang
    #   threshold. Faces right at the boundary (e.g. exactly 45°) are
    #   borderline and don't need mid-air support.
    # - Upper bound: nearly-vertical faces (>70° from horizontal) can
    #   self-support from their edge connections even if starting mid-air.
    mid_air_min_angle = max(angle - 2.0, 0.0)
    nz_midair_steep = -math.cos(math.radians(mid_air_min_angle))
    mid_air_max_angle = min(angle + 25.0, 80.0)
    nz_midair_limit = -math.cos(math.radians(mid_air_max_angle))

    overhang_faces = []

    for i, face in enumerate(part.faces()):
        bb = face.bounding_box()

        # Skip bottom faces sitting on build plate
        if bb.max.Z < 0.5:
            continue

        center = face.center()
        center_normal = face.normal_at(center)

        # For curved faces, sample normals across the surface
        is_planar = str(face.geom_type) == "GeomType.PLANE"
        min_nz = center_normal.Z
        extract_bb = bb  # bounding box used for column extraction

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
                                overhang_verts.append(
                                    (v.X, v.Y, v.Z)
                                )
                        except Exception:
                            pass

                    # Use tighter bbox from overhanging vertices only
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
                        extract_bb = SimpleNamespace(
                            min=tight_min, max=tight_max
                        )
            except Exception:
                pass

        # Skip upward-facing faces (no part of the face points down)
        if min_nz >= 0:
            continue

        reason = None

        # Check 1: overhang angle (use min_nz for curved faces)
        if min_nz < nz_threshold:
            reason = "overhang"
        # Check 2: mid-air — only for faces steep enough to matter but
        # not right at the overhang threshold boundary, and not nearly
        # vertical (which can self-support from edge connections)
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
            print(f"    Face {i}: nz={min_nz:.3f} ({deg:.0f}°), "
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


def _model_to_mesh(
    part: Solid, stl_tolerance: float
) -> trimesh.Trimesh:
    """Tessellate the STEP solid to a trimesh."""
    with tempfile.NamedTemporaryFile(suffix=".stl") as tmp:
        export_stl(part, tmp.name, tolerance=stl_tolerance)
        mesh = trimesh.load(tmp.name)
    return _repair_mesh(mesh)


def compute_supports(
    part: Solid,
    margin: float = 0.2,
    min_volume: float = 1.0,
    stl_tolerance: float = 0.01,
    angle: float = 45.0,
    verbose: bool = False,
    debug: bool = False,
) -> trimesh.Trimesh | None:
    """Compute supports using STEP topology for face detection and trimesh for booleans.

    Algorithm:
      1. Tessellate model
      2. Inflate model mesh outward by margin (Minkowski sum with sphere)
      3. Compute negative space: bounding box - inflated model
      4. For each overhang face: extract the column of negative space
      5. Merge and return
    """
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
        progress.finish_step(f"{negative_mesh.volume:,.0f} mm³")
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
            region = _manifold_boolean(negative_mesh, column, "intersection")
        except Exception:
            continue

        if region is None or region.is_empty:
            continue

        # Split into components, filter by volume.
        # Discard pieces entirely ABOVE the face (strays captured by the
        # XY column). Pieces below are legitimate supports reaching down.
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
        print(f"\n  Done in {elapsed:.1f}s — {len(support_pieces)} pieces, "
              f"{vol:,.1f} mm³")

    return supports


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
    """Compute negative space: outer box - inflated model, clipped to model bbox.

    Args:
        bbox_min: (3,) array — model bounding box minimum corner
        bbox_max: (3,) array — model bounding box maximum corner
        inflated_mesh: trimesh of the inflated model
        margin: gap in mm
    """
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

    # Clip to model bounding box (remove external wrapper)
    model_ext = [bbox_max[0] - bbox_min[0], bbox_max[1] - bbox_min[1], bbox_max[2]]
    model_box = trimesh.creation.box(
        extents=model_ext,
        transform=trimesh.transformations.translation_matrix(
            [cx, cy, model_ext[2] / 2]
        ),
    )
    return _manifold_boolean(negative, model_box, "intersection")


def compute_supports_mesh(
    model_mesh: trimesh.Trimesh,
    margin: float = 0.2,
    min_volume: float = 1.0,
    verbose: bool = False,
) -> trimesh.Trimesh | None:
    """Compute full-shell supports from a mesh (no B-Rep overhang detection).

    The entire negative space around the inflated model becomes support.
    Works with any mesh format (STL, OBJ, PLY, 3MF, etc.).

    Algorithm:
      1. Inflate model mesh outward by margin (Minkowski sum with sphere)
      2. Compute negative space: bounding box - inflated model
      3. Split into pieces, filter small fragments
      4. Merge and return
    """
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
        progress.finish_step(f"{negative_mesh.volume:,.0f} mm³")
    except Exception as e:
        progress.fail_step(str(e))
        print(f"\nError: mesh boolean failed for this model ({e}).")
        print("The model mesh may be non-manifold. Try repairing it")
        print("in your modeling software or with trimesh/meshlab.")
        return None

    # Suppress trimesh warnings about degenerate triangles
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
        print(f"\n  Done in {elapsed:.1f}s — {len(support_pieces)} pieces, "
              f"{vol:,.1f} mm³")

    return supports


def main():
    parser = argparse.ArgumentParser(
        description="Generate negative-space 3D print supports from STEP or mesh files."
    )
    parser.add_argument("input", help="Path to input file (STEP/STP for overhang detection, "
                        "STL/OBJ/PLY/3MF for full-shell supports)")
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
        "-q", "--quiet",
        action="store_true",
        help="Suppress progress display",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Print detailed per-face diagnostics",
    )

    args = parser.parse_args()

    if args.output is None:
        stem = args.input.rsplit(".", 1)[0]
        args.output = f"{stem}_supports.stl"

    show_progress = not args.quiet or args.debug

    # Detect input format by extension
    import os
    ext = os.path.splitext(args.input)[1].lower()
    is_step = ext in STEP_EXTENSIONS

    if is_step:
        # STEP pipeline: B-Rep overhang detection
        if show_progress:
            print(f"Loading {args.input}...")
        part, original_z_min = load_step(args.input, verbose=show_progress)

        if show_progress:
            print(f"\nComputing supports (margin={args.margin}mm, angle={args.angle}°)...")
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
            print(f"Loading {args.input} (mesh mode — full-shell supports)...")
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
    print(f"  {len(supports.faces)} faces, volume = {abs(supports.volume):.1f} mm³")

    if args.export_model and is_step:
        model_stl = args.input.rsplit(".", 1)[0] + ".stl"
        export_stl(part.moved(Location((0, 0, original_z_min))),
                   model_stl, tolerance=args.tolerance)
        print(f"Model written to {model_stl}")


if __name__ == "__main__":
    main()
