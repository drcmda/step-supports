# Project: negative-support

Negative-space 3D print support generator. Available on PyPI (`negative-support`), npm (`negative-support`), and as a browser app at negative.support/try.

## Repo Structure

This is the **public** repo (website + API + issue tracking). The core algorithm lives in a **private submodule** at `core/`.

```
core/                       # git submodule → negative-support-core (private)
  src/negative_support/     # Python algorithm
  packages/negative-support/ # npm TypeScript package
  tests/                    # Cross-platform test suite + baselines
  models/                   # Test models
  pyproject.toml
  requirements.txt

packages/
  server/                   # Cloudflare Worker API
    src/index.ts            # Worker entry, routes /api/* and static
    src/api.ts              # API handlers (free-tier, validate, activate, stripe, checkout)
    src/auth.ts             # GitHub OAuth + session management
    schema.sql              # D1 tables: machines, licenses, users, sessions
    wrangler.toml
  frontend/                 # React SPA (Vite + Tailwind)
    src/                    # Landing, /try page, Success, Docs
    public/                 # Static assets (hero video, outline images)
    vite.config.ts

package.json                # Root scripts (dev, build, deploy, test)
```

## Quick Reference

```bash
# Init submodule (after clone)
git submodule update --init

# Development
npm run dev               # Frontend dev server on :5173
npm run dev:server        # API dev server on :8787

# Build & deploy
npm run build             # Build frontend
npm run deploy            # Build frontend + deploy to Cloudflare

# Tests (runs inside core submodule)
npm test                  # Full cross-platform test suite
npm run test:python       # Python pipeline only
npm run test:baseline     # Legacy STEP regression

# Core packages
npm run build:npm         # Build npm package
npm run build:pip         # Build Python package
```

## Testing

**IMPORTANT**: After ANY change to the algorithm, run the unified test suite:

```bash
npm test
```

This runs:
1. Python pipeline tests against golden baselines
2. Builds npm package
3. npm pipeline tests against same baselines
4. Browser build check

Update baselines after intentional algorithm changes:
```bash
cd core && python3 tests/generate_baselines.py
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

- **Client** (`core/src/negative_support/license.py`): Checks paid token → free tier (server then local) → blocked
- **Server** (`packages/server/src/api.ts`): Cloudflare Workers + D1
  - POST `/api/free-tier` — machine_id tracking (10 free runs)
  - POST `/api/validate` — token lookup
  - POST `/api/activate` — bind token to machine (max 3)
  - POST `/api/webhook/stripe` — payment → generate `ns_live_<32hex>` token
  - POST `/api/checkout` — create Stripe Checkout Session
- **Config**: `~/.negative-support/usage.json` (free tier), `~/.negative-support/license.json` (token)
- **Constants**: `FREE_RUNS=10`, `GRACE_DAYS=7`, `API_BASE=https://negative.support`

## Deploy Checklist

### PyPI
```bash
npm run build:pip
cd core && twine upload dist/*
```

### npm
```bash
npm run build:npm
cd core/packages/negative-support && npm publish
```

### Server (Cloudflare)
```bash
npm run deploy
# First time only:
cd packages/server
npx wrangler d1 create negative-support-db
npm run migrate
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```
