# negative-support — Negative-Space 3D Print Support Generator

Generates model-conforming support structures for 3D printing. Unlike slicer-generated tree or grid supports, these are **negative-space** supports — exact shapes created by subtracting the model from a surrounding block, filling internal cavities (overhangs, bridges, holes) with solid mesh that conforms to the model's actual surface contours.

Available on [npm](https://www.npmjs.com/package/negative-support) and as a browser app at [negative.support/try](https://negative.support/try).

## Install

```bash
npm install -g negative-support
```

Or run directly with npx:

```bash
npx negative-support model.stl
```

## Usage

```bash
negative-support model.step                # STEP: overhang detection
negative-support model.stl                 # Mesh: full-shell supports
negative-support model.step -m 0.15 -a 40  # tighter margin + stricter angle
negative-support model.stl --3mf           # 3MF with model + supports + slicer settings
negative-support model.stl -o out.stl      # custom output path
negative-support model.stl -q              # quiet mode for scripting
```

Supports two input modes:
- **STEP files** (`.step`/`.stp`) — uses B-Rep face topology for smart overhang detection via [occt-import-js](https://github.com/nicecapj/occt-import-js).
- **Mesh files** (`.stl`/`.obj`/`.ply`/`.3mf`) — generates full-shell supports around the entire model.

## API

```js
import { generateSupports } from 'negative-support'
import { readFileSync, writeFileSync } from 'fs'

const buffer = readFileSync('model.stl').buffer
const result = await generateSupports(buffer, {
  format: 'stl',
  margin: 0.2,
})

writeFileSync('model_supports.stl', Buffer.from(result.stl))
console.log(result.stats) // { pieces, faces, volume }
```

## Documentation

Full docs at [negative.support/docs](https://negative.support/docs).

## Repo Structure

This is the public repo (website + API + issue tracking). The core algorithm lives in a private submodule at `packages/core/`.

```
packages/
  core/                     # git submodule → negative-support-core (private)
    src/                    # TypeScript algorithm + CLI source
    tests/                  # Test suite + baselines
    models/                 # Test models
  server/                   # Cloudflare Worker API
  frontend/                 # React SPA (Vite + Tailwind)

package.json                # Root scripts (dev, build, deploy, test)
```

## Development

```bash
git clone --recurse-submodules https://github.com/drcmda/negative-support
npm run dev               # Frontend dev server on :5173
npm run dev:server        # API dev server on :8787
npm test                  # Full test suite
npm run build             # Build frontend
npm run deploy            # Build frontend + deploy to Cloudflare
```

## License

See [negative.support](https://negative.support) for licensing details.
