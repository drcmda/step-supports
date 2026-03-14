# step_supports — Negative-Space 3D Print Support Generator

Generates model-conforming support structures for 3D printing from STEP files. Unlike slicer-generated tree or grid supports, these are **negative-space** supports — exact shapes created by subtracting the model from a surrounding block, filling internal cavities (overhangs, bridges, holes) with solid mesh that conforms to the model's actual surface contours.

The output is a separate STL file that can be imported alongside the model in your slicer.

## Requirements

- Python 3.10+
- [build123d](https://github.com/gumyr/build123d) (OpenCascade wrapper for STEP/B-Rep)
- [trimesh](https://trimesh.org/) with [manifold3d](https://github.com/elalish/manifold) backend
- numpy

```
pip install -r requirements.txt
```

## Usage

```
python3 step_supports.py model.step [options]
```

### Parameters

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `input` | | *(required)* | Path to input STEP file |
| `--output` | `-o` | `<input>_supports.stl` | Output STL path for the generated supports |
| `--margin` | `-m` | `0.2` | Gap between support and model in mm. This clearance allows supports to be removed after printing. Larger values are easier to remove but less precise. |
| `--angle` | `-a` | `45.0` | Overhang angle threshold in degrees from horizontal. Faces steeper than this receive supports. Most FDM printers handle up to 45° without support. Lower values generate more supports. |
| `--min-volume` | | `1.0` | Discard support pieces smaller than this volume in mm³. Filters out tiny slivers and artifacts. |
| `--tolerance` | | `0.01` | STL tessellation tolerance in mm. Lower values produce smoother curved surfaces but larger files. |
| `--export-model` | `-e` | off | Also export the STEP model as STL (saved as `<input>.stl`). Convenient when you only have the STEP file and need an STL for your slicer. |
| `--quiet` | `-q` | off | Suppress the progress display. Only the final output summary is printed. |
| `--debug` | | off | Print detailed per-face diagnostics: face normals, angles, bounding boxes, stray discards. |

### Examples

Basic usage (shows live progress by default):
```
python3 step_supports.py bracket.step
```

Quiet mode for scripting:
```
python3 step_supports.py bracket.step -q
```

Tighter margin and stricter overhang angle:
```
python3 step_supports.py bracket.step -m 0.15 -a 40
```

Export model STL alongside supports:
```
python3 step_supports.py bracket.step -e
```

Debug mode for investigating face detection:
```
python3 step_supports.py bracket.step --debug
```

## How It Works

1. **Load STEP** — imports the B-Rep model with full parametric face topology
2. **Inflate** — grows the model mesh outward by the margin using Minkowski sum with a sphere (via manifold3d). This creates an exact, uniform gap between supports and model on all surfaces.
3. **Detect overhangs** — identifies faces that need support:
   - **Angle threshold**: faces with downward normals steeper than `--angle` (sampled across curved faces, not just at center)
   - **Mid-air detection**: faces that start printing with no material below, regardless of angle
4. **Negative space** — computes the void around the inflated model (bounding box minus inflated mesh)
5. **Extract supports** — for each overhang face, creates a vertical column matching the face's XY footprint and intersects it with the negative space
6. **Filter** — removes tiny fragments and stray pieces above the originating face
7. **Merge & export** — combines all support pieces into a single STL file

## Progress Display

By default, the tool shows a live multi-step progress display with a spinner and timing:

```
  ✓ Tessellate          28,912 faces          0.1s
  ✓ Inflate             150,788 faces        22.3s
  ✓ Negative space      702,596 mm³           0.1s
  ✓ Detect overhangs    92 faces              2.4s
  ✓ Extract supports    134 pieces            1.9s
  ✓ Merge               113,754 faces         0.0s
```

The extraction step shows a progress bar when processing many faces. Use `-q` to suppress this output.

## Testing

A baseline regression test ensures support generation stays consistent:

```bash
python3 tests/baseline.py            # compare against known-good snapshot
python3 tests/baseline.py --update   # update baseline after intentional changes
```

The test compares piece count (must match exactly), total volume (5% tolerance), and per-piece volumes (10% tolerance) against a saved snapshot generated from the reference algorithm.

## Limitations

- **STEP input only** — STL/mesh files lack the B-Rep topology needed for reliable face detection
- **No tree supports** — generates solid block supports, which use more material but conform exactly to the model surface
- **Processing time** — the Minkowski sum inflation step can take 20-30s on complex models (400+ faces)

## Project Structure

```
step_supports.py          Main support generator
models/                   STEP/STL model files
tests/
  baseline.py             Baseline regression test
  baseline.json           Saved baseline snapshot
  baseline_generator.py   Reference inflation algorithm
  test_model_supports.stl Reference support mesh
stl_supports.py           Legacy STL-based approach (deprecated)
```
