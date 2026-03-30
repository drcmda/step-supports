---
name: project_history
description: Complete development history of the negative-support project — decisions, failures, pivots, and the chain of causation that led to the current architecture
type: project
---

# Development History

## Starting Point

Negative-support: a tool that generates 3D print supports shaped like the negative space around a model. Available as npm package, CLI, and browser app at negative.support. Core algorithm uses **manifold-3d** for boolean operations and **occt-import-js** for STEP file parsing.

Two input modes: STEP (B-Rep overhang detection) and mesh/STL (full-shell or triangle-normal clustering).

---

## The STEP Manifold Crisis

### Problem: "Not manifold" errors on STEP files

STEP files parsed by occt-import-js produce meshes where each B-Rep face has its own vertex set. Adjacent faces share edges geometrically but have **duplicate vertices** at boundaries.

### Attempt 1: Manual vertex deduplication in parseSTEP
- Used `.toFixed(6)` position keys to merge coincident vertices
- **Result**: Reduced 52K verts to 26K, but introduced **non-manifold edges** at face boundaries
- **Why it failed**: Position-based dedup can't distinguish topological boundaries from geometric coincidence. Merging across certain face boundaries created edges shared by >2 faces.

### Attempt 2: Remove dedup, let manifold-3d handle it
- Kept raw occt mesh with duplicates
- `Mesh.merge()` in manifold-3d does heuristic vertex welding
- **Result**: Raw mesh passes `ofMesh()`. But inflation on duplicate vertices creates self-intersections (divergent normals).

### Attempt 3: inflateToManifold with two strategies
- **Strategy 1**: Inflate raw mesh → convert to manifold (fast, works for STL)
- **Strategy 2 (fallback)**: Convert to manifold first → extract clean mesh → inflate clean mesh → convert back
- **Result**: Worked but Strategy 2 is **lossy** — the manifold roundtrip simplifies tessellation, losing detail. Supports became visibly coarser than STL output.

### Attempt 4: Normal merging in inflateMesh
- After computing vertex normals, merge normals of duplicate vertices using `toFixed(5)` position keys
- **Result**: Strategy 1 now succeeds for STEP files. But `toFixed(5)` precision is inconsistent — misses some duplicates, occasionally merges across sharp edges. Quality still degraded at margins >= 0.3mm.

### Attempt 5: weldVertices spatial hash
- Proper vertex deduplication using spatial hash with Euclidean distance (tolerance 1e-5)
- Weld **before** inflation so each position has one vertex with one correct normal
- **Result**: Fixed the duplicate vertex problem cleanly. But vertex-normal inflation itself is fundamentally flawed at larger margins — sharp edges/corners get distorted.

### Final solution: Minkowski sum (manifold-3d 3.4.1)
- `manifold.minkowskiSum(sphere)` — mathematically exact uniform offset
- No vertex normals, no self-intersections, no edge artifacts at any margin
- Required upgrading manifold-3d from 3.4.0 to 3.4.1
- Required adding **Cross-Origin-Opener-Policy / Cross-Origin-Embedder-Policy** headers (3.4.1 uses TBB which needs SharedArrayBuffer)
- Tradeoff: slower (1-40s depending on mesh complexity) but perfect quality
- `weldVertices` still needed to clean STEP duplicates before manifold conversion

**Key lesson**: Vertex-normal inflation is an approximation that breaks at scale. Minkowski sum is the correct mathematical operation for mesh offsetting.

---

## The 3MF Positioning Bug

### Problem: Support pieces displaced in BambuStudio

BambuStudio auto-drops each `<item>` in a 3MF to the build plate (z=0). Floating support pieces (e.g. hole fillers starting at z=5) got repositioned to the wrong location.

### Attempt 1: Identity transform on items
- Added `transform="1 0 0 0 1 0 0 0 1 0 0 0"` to each `<item>`
- **Failed**: BambuStudio ignores the transform and still auto-drops

### Attempt 2: Shift vertices to z=0, use transform to reposition
- Shifted each piece's vertices so z_min=0, added translate transform
- **Failed**: BambuStudio still ignores the transform

### Attempt 3: Degenerate anchor triangle at z=0
- Added a zero-area triangle at z=0 to each floating piece
- **Reverted by user**: Adding geometry is a hack, not clean

### Final solution: Assembly with components
- Single `<object type="model">` assembly with `<components>` referencing all parts
- Single `<item>` in `<build>` pointing to the assembly
- Per-part slicer settings via `<part id="..." subtype="normal_part">` under the assembly in `model_settings.config`
- **Result**: Correct positions AND per-object editable properties in BambuStudio

---

## The Double TranslateZ Bug

### Problem: Some support pieces offset by exactly the model's z_min

The pipeline translates the model to z=0 for processing, then translates back. When `concatMeshes` returned the same reference for single-piece arrays, `translateZ` was applied to both `outMesh` and `supportPieces[0]` — same Float32Array, doubled offset.

**Fix**: `concatMeshes` always returns a new copy. Same pattern fixed in `finalizeSupports` for the single-group case.

---

## OOM on Large Models

### Problem: "memory access out of bounds" during mergeOverlapping

Manifold-3d's WASM heap exhausted when unioning many complex pieces (e.g. 109 pieces from a 40MB OBJ).

### Solution: skipMerge retry
- CLI: catches WASM OOM, retries with `skipMerge=true`
- Browser: worker crash triggers fresh worker with `skipMerge` flag
- `skipMerge` path uses `concatMeshes` instead of boolean union — keeps pieces separate

---

## Browser Architecture

### Shared STEP processing
- `processOcctResult()` in `step-process.ts` — single source of truth for mesh extraction from occt-import-js
- Browser `step.ts` handles WASM init (locateFile for Vite), delegates parsing to shared function
- Previously had duplicated parsing logic that diverged (dedup in one but not the other)

### 3D Viewer (react-three-fiber)
- Lazy-loaded MeshViewer component — three.js only loads after generation completes
- Worker sends raw geometry via Transferable (zero-copy) alongside STL/3MF buffers
- Model: ghosted/transparent. Supports: accent green, slightly transparent
- OrbitControls, auto-fit camera via drei `<Bounds>`

### Cross-origin isolation
- manifold-3d 3.4.1 uses TBB (Threading Building Blocks) requiring SharedArrayBuffer
- Added COOP/COEP headers to both Vite dev server and Cloudflare Worker
- All resources are self-hosted (fonts, WASM) so COEP doesn't break anything

---

## Technologies

| Technology | Purpose |
|---|---|
| **manifold-3d** 3.4.1 | Boolean ops (subtract, intersect, union, decompose), Minkowski sum |
| **occt-import-js** | STEP/STP file parsing (OpenCASCADE compiled to WASM) |
| **React + Vite** | Frontend SPA |
| **react-three-fiber + drei** | 3D mesh preview after generation |
| **Cloudflare Workers + D1** | API server, static hosting, SQLite database |
| **Stripe** | Payment processing (lifetime license) |
| **GitHub OAuth** | User authentication |
| **tsup + terser** | npm package build (minified, no source maps) |
| **Tailwind CSS 4** | Styling with custom theme (dark, accent green) |
| **Geist fonts** | Pixel Grid, Pixel Square, Pixel Circle variants for data display |

---

## Timeline of Key Decisions

1. **Dropped Python/pip** — single source of truth in TypeScript/npm
2. **License gate on npm API** — `activate(token)` required before `generateSupports()`
3. **100 free runs** (was 10) — users need confidence before paying
4. **STEP tessellation params** — `linearDeflection: 0.05, angularDeflection: 0.1` for quality
5. **Minkowski over vertex-normal inflation** — correctness > speed
6. **Assembly-based 3MF** — only way to get correct positioning + per-part properties in BambuStudio
