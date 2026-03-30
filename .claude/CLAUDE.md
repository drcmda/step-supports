# Project: negative-support

Negative-space 3D print support generator. Available on npm (`negative-support`) and as a browser app at negative.support/generate.

## Repo Structure

This is the **public** repo (website + API + issue tracking). The core algorithm lives in a **private submodule** at `packages/core/`.

```
packages/
  core/                     # git submodule → negative-support-core (private)
    src/                    # TypeScript algorithm + CLI source
    tests/                  # Test suite + baselines
    models/                 # Test models
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
npm test                  # Full test suite (build + baselines + browser)
npm run test:baseline     # Legacy STEP regression

# Generate supports for a model
npm run generate -- packages/core/models/stock_t.step

# Core package
npm run build:npm         # Build npm package
```

## Testing

**IMPORTANT**: After ANY change to the algorithm, run the test suite:

```bash
npm test
```

Update baselines after intentional algorithm changes:
```bash
cd packages/core && node tests/generate_baselines.mjs
```

## Architecture

- **Two platforms**: JavaScript (npm) and Browser (WASM). Same algorithm, same code.
- **Vertex-normal offset inflation**: Each vertex is moved outward along its area-weighted normal by `margin`. Replaces Minkowski sum — within 0.3% for typical models, significantly faster.
- **Two input modes**: STEP (B-Rep overhang detection) and mesh (full-shell). Auto-detected by extension.
- **occt-import-js**: Peer dependency for STEP file support. Uses OpenCASCADE compiled to WASM.
- **B-Rep face detection** (STEP): Per-face normals determine overhangs. Column extraction isolates supports per face.
- **manifold-3d**: Boolean operations (subtract, intersect, union, decompose).

## Licensing System

- **Server** (`packages/server/src/api.ts`): Cloudflare Workers + D1
  - POST `/api/free-tier` — machine_id tracking (10 free runs)
  - POST `/api/validate` — token lookup
  - POST `/api/activate` — bind token to machine (max 3)
  - POST `/api/webhook/stripe` — payment → generate `ns_live_<32hex>` token
  - POST `/api/checkout` — create Stripe Checkout Session
- **Constants**: `FREE_RUNS=100`, `GRACE_DAYS=7`, `API_BASE=https://negative.support`

## Deploy Checklist

### npm
```bash
npm run build:npm
cd packages/core && npm publish
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
