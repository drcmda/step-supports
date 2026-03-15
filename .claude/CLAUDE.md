# Project: negative-support

Negative-space 3D print support generator, published as `negative-support` on PyPI.

## Quick Reference

```bash
# Python CLI
source .venv/bin/activate
negative-support --version
python tests/baseline.py

# Build package
pip install build && python -m build

# Server (local)
cd server && npm run dev          # API on :8787
cd server/web && npm run dev      # React on :5173
```

## Testing

**IMPORTANT**: After ANY change to `src/negative_support/cli.py`, run the baseline test:

```bash
python tests/baseline.py
```

Compares output against known-good snapshot (test_model.step):
- Volume tolerance: 5% for totals, 10% per piece
- Piece count must match exactly

Update baseline after intentional changes:
```bash
python tests/baseline.py --update
```

## Project Structure

```
src/negative_support/
  __init__.py       # __version__, public API exports
  cli.py            # Main CLI + compute_supports + compute_supports_mesh
  license.py        # License checking, free tier, token validation
  progress.py       # ProgressDisplay (spinner, progress bar, ANSI)

server/
  src/index.ts      # Cloudflare Worker entry, routes /api/* and static
  src/api.ts        # API handlers (free-tier, validate, activate, stripe, checkout)
  schema.sql        # D1 tables: machines, licenses, machine_licenses
  web/              # React SPA (Vite): Landing, Success, Docs pages

step_supports.py    # Backwards-compat wrapper → imports from negative_support
tests/baseline.py   # Regression test (imports from negative_support.cli)
pyproject.toml      # Hatchling build, entry point: negative-support
```

## Architecture

- **Two input modes**: STEP (B-Rep overhang detection) and mesh (full-shell). Auto-detected by extension.
- **build123d optional**: Only imported for STEP files. Mesh-only works without it.
- **Minkowski sum inflation**: `manifold3d.Manifold.minkowski_sum(sphere)` for margin gap.
- **B-Rep face detection** (STEP only): Normals sampled across curved faces, mid-air detection via raycasting.
- **Per-face column extraction** (STEP only): Each overhang face's XY bbox defines a vertical column intersected with negative space.

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
