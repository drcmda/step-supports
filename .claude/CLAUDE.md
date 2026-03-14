# Project: STEP Support Generator

## Testing Requirements

**IMPORTANT**: After ANY change to `step_supports.py`, always run the baseline test:

```bash
python3 tests/baseline.py
```

This compares the current output against a known-good snapshot (test_model.step).
The test checks piece count, total volume, and per-piece volumes.

- Volume tolerance: 5% for totals, 10% per piece
- Piece count must match exactly

If the test fails, investigate before committing. If the change is intentional
(e.g. algorithm improvement), update the baseline:

```bash
python3 tests/baseline.py --update
```

## Project Structure

- `step_supports.py` — Main support generator (Minkowski sum inflation)
- `models/` — STEP/STL model files
- `tests/baseline.py` — Baseline regression test
- `tests/baseline.json` — Saved baseline snapshot
- `tests/baseline_generator.py` — Reference inflation algorithm (B-Rep offset)
- `stl_supports.py` — Legacy STL-based approach (deprecated)

## Key Architecture Decisions

- **Minkowski sum inflation** for margins: model mesh is inflated outward by
  `margin` using `manifold3d.Manifold.minkowski_sum(sphere)`, then
  `box - inflated_model` gives negative space with built-in margin gap.
  This replaces the fragile B-Rep offset approach.
- **B-Rep face detection**: STEP topology gives exact overhang faces with
  proper normals on curved surfaces. Normals are sampled across curved faces.
- **Per-face column extraction**: Each overhang face defines a vertical column
  (XY bounding box). The column intersects the negative space to extract
  that face's support region.
- **Mid-air detection**: Faces that pass the angle threshold but start with
  nothing below them get supports regardless of angle. Capped at angle+25°
  to exclude near-vertical faces.
- **Progress display**: Always shown by default (suppress with `-q`).
  Uses ANSI in-place rendering with braille spinner and progress bar.
