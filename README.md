# step_supports — Negative-Space 3D Print Support Generator

Generates model-conforming support structures for 3D printing. Unlike slicer-generated tree or grid supports, these are **negative-space** supports — exact shapes created by subtracting the model from a surrounding block, filling internal cavities (overhangs, bridges, holes) with solid mesh that conforms to the model's actual surface contours.

Supports two input modes:
- **STEP files** (`.step`/`.stp`) — uses B-Rep face topology for smart overhang detection. Only faces that actually need support get it.
- **Mesh files** (`.stl`/`.obj`/`.ply`/`.3mf`) — generates full-shell supports around the entire model. No overhang detection (no B-Rep topology), so all surfaces get support. Uses more material but works with any mesh format.

The output is a separate STL file that can be imported alongside the model in your slicer.

## Requirements

- Python 3.10+
- [trimesh](https://trimesh.org/) with [manifold3d](https://github.com/elalish/manifold) backend
- numpy
- [build123d](https://github.com/gumyr/build123d) *(optional — only needed for STEP input)*

```
pip install -r requirements.txt
```

## Usage

```
python3 step_supports.py model.step [options]    # STEP: overhang detection
python3 step_supports.py model.stl [options]     # Mesh: full-shell supports
```

The input format is auto-detected by file extension. `.step`/`.stp` files use the STEP pipeline with B-Rep overhang detection. All other extensions use the mesh pipeline with full-shell supports.

### Parameters

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `input` | | *(required)* | Path to input file (STEP/STP or STL/OBJ/PLY/3MF) |
| `--output` | `-o` | `<input>_supports.stl` | Output STL path for the generated supports |
| `--margin` | `-m` | `0.2` | Gap between support and model in mm. This clearance allows supports to be removed after printing. Larger values are easier to remove but less precise. |
| `--angle` | `-a` | `45.0` | Overhang angle threshold in degrees from horizontal *(STEP only)*. Faces steeper than this receive supports. Most FDM printers handle up to 45° without support. |
| `--min-volume` | | `1.0` | Discard support pieces smaller than this volume in mm³. Filters out tiny slivers and artifacts. |
| `--tolerance` | | `0.01` | STL tessellation tolerance in mm *(STEP only)*. Lower values produce smoother curved surfaces but larger files. |
| `--export-model` | `-e` | off | Also export the STEP model as STL *(STEP only)*. Convenient when you only have the STEP file and need an STL for your slicer. |
| `--quiet` | `-q` | off | Suppress the progress display. Only the final output summary is printed. |
| `--debug` | | off | Print detailed per-face diagnostics *(STEP only)*: face normals, angles, bounding boxes, stray discards. |

### Examples

STEP input with overhang detection:
```
python3 step_supports.py bracket.step
```

STL input with full-shell supports:
```
python3 step_supports.py bracket.stl
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

## How It Works

### STEP Pipeline (overhang detection)

1. **Load STEP** — imports the B-Rep model with full parametric face topology
2. **Tessellate** — converts the parametric model to a triangle mesh
3. **Inflate** — grows the model mesh outward by the margin using Minkowski sum with a sphere (via manifold3d)
4. **Detect overhangs** — identifies faces that need support using B-Rep normals and mid-air detection
5. **Extract supports** — for each overhang face, creates a vertical column and intersects it with the negative space
6. **Merge & export** — combines all support pieces into a single STL file

### Mesh Pipeline (full-shell)

1. **Load mesh** — imports the triangle mesh directly
2. **Inflate** — grows the mesh outward by the margin (same Minkowski sum)
3. **Negative space** — computes the void around the inflated model (bounding box minus inflated mesh)
4. **Split & filter** — separates into pieces and removes tiny fragments
5. **Merge & export** — combines all support pieces into a single STL file

## Progress Display

By default, the tool shows a live progress display with a spinner and timing.

STEP mode:
```
  ✓ Tessellate          28,912 faces          0.1s
  ✓ Inflate             150,788 faces        22.3s
  ✓ Negative space      702,596 mm³           0.1s
  ✓ Detect overhangs    92 faces              2.4s
  ✓ Extract supports    134 pieces            1.9s
  ✓ Merge               113,754 faces         0.0s
```

Mesh mode:
```
  ✓ Inflate             87,980 faces         10.2s
  ✓ Negative space      702,609 mm³           0.1s
  ✓ Split & filter      1 pieces              0.1s
  ✓ Merge               84,924 faces          0.0s
```

Use `-q` to suppress this output.

## Testing

A baseline regression test ensures STEP support generation stays consistent:

```bash
python3 tests/baseline.py            # compare against known-good snapshot
python3 tests/baseline.py --update   # update baseline after intentional changes
```

The test compares piece count (must match exactly), total volume (5% tolerance), and per-piece volumes (10% tolerance) against a saved snapshot generated from the reference algorithm.

## Limitations

- **No tree supports** — generates solid block supports, which use more material but conform exactly to the model surface
- **Mesh input = full shell** — without B-Rep topology, every surface gets support. Use STEP input for smart overhang-only supports.
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
