# negative-support — Negative-Space 3D Print Support Generator

Generates model-conforming support structures for 3D printing. Unlike slicer-generated tree or grid supports, these are **negative-space** supports — exact shapes created by subtracting the model from a surrounding block, filling internal cavities (overhangs, bridges, holes) with solid mesh that conforms to the model's actual surface contours.

Supports two input modes:
- **STEP files** (`.step`/`.stp`) — uses B-Rep face topology for smart overhang detection. Only faces that actually need support get it.
- **Mesh files** (`.stl`/`.obj`/`.ply`/`.3mf`) — generates full-shell supports around the entire model. No overhang detection (no B-Rep topology), so all surfaces get support. Uses more material but works with any mesh format.

The output is a separate STL file that can be imported alongside the model in your slicer.

---

## Install

Requires Python 3.10+.

```bash
pip install negative-support
```

For STEP file support (B-Rep overhang detection), install the optional dependency:

```bash
pip install negative-support[step]
```

## Usage

```bash
negative-support model.step                # STEP: overhang detection
negative-support model.stl                 # Mesh: full-shell supports
negative-support model.step -m 0.15 -a 40  # tighter margin + stricter angle
negative-support model.step -e             # also export model as STL
negative-support model.step -q             # quiet mode for scripting
```

The input format is auto-detected by file extension.

### CLI Flags

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `input` | | *(required)* | Path to input file (STEP/STP or STL/OBJ/PLY/3MF) |
| `--output` | `-o` | `<input>_supports.stl` | Output STL path |
| `--margin` | `-m` | `0.2` | Gap between support and model (mm) |
| `--angle` | `-a` | `45.0` | Overhang angle threshold (STEP only) |
| `--min-volume` | | `1.0` | Discard support pieces smaller than this (mm³) |
| `--tolerance` | | `0.01` | STL tessellation tolerance (STEP only) |
| `--export-model` | `-e` | off | Also export the STEP model as STL |
| `--quiet` | `-q` | off | Suppress progress display |
| `--debug` | | off | Print per-face diagnostics (STEP only) |

### License Commands

```bash
negative-support --status                          # show license status
negative-support --buy                             # open purchase page in browser
negative-support --activate ns_live_<your_token>   # activate a license token
negative-support --version                         # show version
```

### Python API

```python
from negative_support import load_step, compute_supports

part, z_offset = load_step("model.step")
supports = compute_supports(part, margin=0.2, angle=45.0)
supports.export("supports.stl")

from negative_support import load_mesh, compute_supports_mesh

mesh, z_offset = load_mesh("model.stl")
supports = compute_supports_mesh(mesh, margin=0.2)
supports.export("supports.stl")
```

## Progress Display

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

---

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

---

## Licensing

Free tier: **3 runs per machine**, no account needed. After that, a lifetime license is required ($19, one-time).

- Tracked server-side via machine fingerprint (SHA-256 of hostname + MAC + OS + arch + username)
- Offline fallback: local counter in `~/.negative-support/usage.json`
- Token format: `ns_live_<32 hex chars>`, stored in `~/.negative-support/license.json`
- Grace period: 7 days offline after last server validation

---

## Project Structure

```
├── pyproject.toml                    # Package metadata (hatchling)
├── src/negative_support/
│   ├── __init__.py                   # Version + public API
│   ├── cli.py                        # Main CLI + compute functions
│   ├── license.py                    # License checking + free tier
│   └── progress.py                   # ProgressDisplay (spinner/bar)
├── server/
│   ├── wrangler.toml                 # Cloudflare Worker config
│   ├── package.json                  # Server dependencies
│   ├── schema.sql                    # D1 database migration
│   ├── src/
│   │   ├── index.ts                  # Worker entry + router
│   │   └── api.ts                    # API route handlers
│   └── web/                          # React SPA (Vite)
│       ├── package.json
│       ├── vite.config.ts
│       └── src/
│           ├── App.tsx               # Router
│           ├── pages/Landing.tsx     # Landing page + pricing
│           ├── pages/Success.tsx     # Post-payment token display
│           └── pages/Docs.tsx        # Usage documentation
├── step_supports.py                  # Backwards-compat wrapper
├── tests/
│   ├── baseline.py                   # Regression test
│   ├── baseline.json                 # Saved snapshot
│   └── baseline_generator.py         # Reference algorithm
└── models/                           # Dev-only test models
```

---

## Development

### Local setup (Python CLI)

```bash
# Create venv with Python 3.10+
python3.13 -m venv .venv
source .venv/bin/activate

# Install in editable mode
pip install -e .              # mesh-only
pip install -e ".[step]"      # mesh + STEP support

# Verify
negative-support --version
negative-support --status
```

### Dev mode (skip license checks)

```bash
source .venv/bin/activate
NS_DEV=1 negative-support models/body.step
NS_DEV=1 negative-support models/follower.stl

# Or export for the whole session
export NS_DEV=1
negative-support models/handle.step
negative-support models/stock.step

# Run all STEP models
for f in models/*.step; do echo "=== $f ===" && negative-support "$f"; done

# Run all STL models (skip _supports files)
for f in models/*.stl; do [[ "$f" != *_supports.stl ]] && echo "=== $f ===" && negative-support "$f"; done
```

### Run tests

```bash
source .venv/bin/activate
python tests/baseline.py                # compare against snapshot
python tests/baseline.py --update       # update after intentional changes
```

### Build package

```bash
pip install build
python -m build
ls dist/   # negative_support-0.1.0.tar.gz + .whl
```

### Publish to PyPI

```bash
pip install twine

# Test PyPI first
twine upload --repository testpypi dist/*

# Production
twine upload dist/*
```

### Local setup (Server)

```bash
cd server
npm install
cd web && npm install && cd ..

# Copy env template
cp .dev.vars.example .dev.vars
# Edit .dev.vars with real Stripe keys
```

### Run server locally

```bash
# Terminal 1: API server
cd server
npm run migrate:local    # create D1 tables locally
npm run dev              # wrangler dev on :8787

# Terminal 2: React dev server
cd server/web
npm run dev              # vite on :5173, proxies /api to :8787
```

### Deploy server

```bash
cd server

# 1. Create D1 database (first time only)
npx wrangler d1 create negative-support-db
# Copy the database_id into wrangler.toml

# 2. Run migration
npm run migrate

# 3. Set secrets
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET

# 4. Update placeholders in src/api.ts:
#    - PRICE_ID → your Stripe Price ID
#    - SUCCESS_URL / CANCEL_URL → your domain

# 5. Build frontend + deploy worker
npm run deploy

# 6. Set up Stripe webhook in Dashboard:
#    URL: https://<worker>.workers.dev/api/webhook/stripe
#    Events: checkout.session.completed
```

### Server API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/free-tier` | Track machine runs, return remaining |
| POST | `/api/validate` | Check token validity |
| POST | `/api/activate` | Bind token to machine (max 3) |
| POST | `/api/webhook/stripe` | Stripe payment → generate token |
| GET | `/api/token?session_id=x` | Fetch token after payment |
| POST | `/api/checkout` | Create Stripe Checkout Session |

### Server database (D1/SQLite)

- **machines**: `machine_id`, `runs_used`, `first_seen`, `last_seen`
- **licenses**: `token`, `email`, `plan`, `stripe_session_id`, `created_at`
- **machine_licenses**: `token`, `machine_id`, `activated_at` (max 3 per token)

---

## Limitations

- **No tree supports** — generates solid block supports, which use more material but conform exactly to the model surface
- **Mesh input = full shell** — without B-Rep topology, every surface gets support. Use STEP input for smart overhang-only supports.
- **Processing time** — the Minkowski sum inflation step can take 20-30s on complex models (400+ faces)
