# Project: negative-support

Negative-space 3D print support generator. Available on PyPI (`negative-support`), npm (`negative-support`), and as a browser app at negative.support/try.

## Quick Reference

```bash
# Python CLI
source .venv/bin/activate
negative-support --version
python tests/baseline.py

# npm package
cd packages/negative-support && npm run build
node -e "import {generateSupports} from './dist/index.js'"

# Server (local)
cd server && npm run dev          # API on :8787
cd server/web && npm run dev      # React on :5173

# Run all platform tests
python tests/run_all.py
```

## Testing

**IMPORTANT**: After ANY change to the algorithm, run the unified test suite:

```bash
python tests/run_all.py
```

This runs:
1. Python pipeline tests against golden baselines
2. Builds npm package
3. npm pipeline tests against same baselines
4. Browser build check

Update baselines after intentional algorithm changes:
```bash
python tests/generate_baselines.py
```

Legacy STEP-specific baseline (kept for backwards compat):
```bash
python tests/baseline.py          # compare
python tests/baseline.py --update # update
```

## Project Structure

```
src/negative_support/
  __init__.py       # __version__, public API exports
  cli.py            # Main CLI + compute_supports + compute_supports_mesh
  license.py        # License checking, free tier, token validation
  progress.py       # ProgressDisplay (spinner, progress bar, ANSI)

packages/negative-support/  # npm package
  src/index.ts      # Public API: generateSupports()
  src/supports.ts   # Core algorithm (mesh + STEP pipelines)
  src/stl.ts        # STL parser/exporter
  src/obj.ts        # OBJ parser
  src/step.ts       # STEP parser (occt-import-js)
  src/mesh-utils.ts # Repair, inflate, bbox, volume

server/
  src/index.ts      # Cloudflare Worker entry, routes /api/* and static
  src/api.ts        # API handlers (free-tier, validate, activate, stripe, checkout)
  schema.sql        # D1 tables: machines, licenses, machine_licenses
  web/              # React SPA (Vite): Landing, /try page, Success, Docs

tests/
  baselines/        # Golden baseline JSONs (per model × pipeline)
  run_all.py        # Unified cross-platform test runner
  test_python.py    # Python pipeline validation
  test_npm.mjs      # npm package validation
  generate_baselines.py  # Regenerate golden baselines from Python
  baseline.py       # Legacy STEP regression test

pyproject.toml      # Hatchling build, entry point: negative-support
```

## Architecture

- **Three platforms**: Python (pip), JavaScript (npm), Browser (WASM). All use the same algorithm.
- **Vertex-normal offset inflation**: Each vertex is moved outward along its area-weighted normal by `margin`. Replaces Minkowski sum — within 0.3% for typical models, significantly faster.
- **Two input modes**: STEP (B-Rep overhang detection) and mesh (full-shell). Auto-detected by extension.
- **build123d optional** (Python only): Only imported for STEP files. Mesh-only works without it.
- **occt-import-js optional** (npm only): Peer dependency for STEP file support in JavaScript.
- **B-Rep face detection** (STEP): Per-face normals determine overhangs. Column extraction isolates supports per face.
- **manifold-3d/manifold3d**: Boolean operations (subtract, intersect, union, decompose) shared across all platforms.

## Licensing System

- **Client** (`license.py`): Checks paid token → free tier (server then local) → blocked
- **Server** (`server/src/api.ts`): Cloudflare Workers + D1
  - POST `/api/free-tier` — machine_id tracking (3 free runs)
  - POST `/api/validate` — token lookup
  - POST `/api/activate` — bind token to machine (max 3)
  - POST `/api/webhook/stripe` — payment → generate `ns_live_<32hex>` token
  - POST `/api/checkout` — create Stripe Checkout Session
- **Config**: `~/.negative-support/usage.json` (free tier), `~/.negative-support/license.json` (token)
- **Constants**: `FREE_RUNS=3`, `GRACE_DAYS=7`, `API_BASE=https://negative.support`

## Deploy Checklist

### PyPI
```bash
pip install build twine
python -m build
twine upload dist/*
```

### npm
```bash
cd packages/negative-support
npm run build
npm publish
```

### Server (Cloudflare)
```bash
cd server
npx wrangler d1 create negative-support-db   # get database_id → wrangler.toml
npm run migrate                               # create tables
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
# Update PRICE_ID, SUCCESS_URL, CANCEL_URL in src/api.ts
npm run deploy
# Set Stripe webhook: https://<worker>.workers.dev/api/webhook/stripe
```
