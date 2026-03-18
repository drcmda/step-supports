# negative-support — Negative-Space 3D Print Support Generator

Generates model-conforming support structures for 3D printing. Unlike slicer-generated tree or grid supports, these are **negative-space** supports — exact shapes created by subtracting the model from a surrounding block, producing solid mesh that conforms to the model's actual surface contours.

Available on [npm](https://www.npmjs.com/package/negative-support) and as a browser app at [negative.support/generate](https://negative.support/generate).

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
negative-support model.step                # STEP with B-Rep overhang detection
negative-support model.stl                 # STL with triangle-normal overhang detection
negative-support model.obj -m 0.15 -a 40   # tighter margin + stricter angle
negative-support model.step --3mf          # 3MF with model + supports + slicer settings
negative-support model.stl -o out.stl      # custom output path
negative-support model.stl -q              # quiet mode for scripting
```

### Options

| Flag                  | Default                | Description                      |
| --------------------- | ---------------------- | -------------------------------- |
| `-m, --margin <mm>`   | `0.2`                  | Gap between supports and model   |
| `-a, --angle <deg>`   | `45`                   | Overhang angle threshold         |
| `--min-volume <mm³>`  | `1.0`                  | Discard pieces smaller than this |
| `--3mf`               | off                    | Export 3MF with model + supports |
| `-o, --output <path>` | `<input>_supports.stl` | Output path                      |
| `-q, --quiet`         | off                    | Suppress progress display        |

## How It Works

### 1. Overhang Detection

Both STEP and mesh files produce targeted per-region supports through overhang detection:

- **STEP files** (`.step`/`.stp`) — B-Rep face topology provides exact face boundaries and normals via [occt-import-js](https://github.com/nicecapj/occt-import-js). Each face with a downward normal steeper than the angle threshold becomes a support region.
- **Mesh files** (`.stl`/`.obj`) — Triangle normals are computed per-face, then adjacent overhang triangles are clustered via BFS flood fill over shared edges. Each cluster becomes a support region, producing results comparable to STEP.

### 2. Support Generation

For each overhang region:

1. **Bounding box column** — A vertical column is extracted from the region's AABB, extending down to the build plate
2. **Negative space** — The inflated model (offset outward by `margin` along vertex normals) is subtracted from the column using boolean operations ([manifold-3d](https://github.com/elalish/manifold))
3. **Decomposition** — The resulting shape is split into separate pieces
4. **Filtering** — Pieces smaller than `minVolume` or not touching the build plate are discarded
5. **Merge** — Overlapping pieces from adjacent regions are merged via geometric intersection testing

### 3. Output

- **STL** (default) — All support pieces merged into a single binary STL
- **3MF** (`--3mf`) — Model + individual support pieces as separate objects with per-piece slicer settings (1 wall, 10% cubic infill)

## API

Call `activate()` with your license token before generating. The token is the same one you use for the CLI.

```js
import { generateSupports, activate } from 'negative-support'
import { readFileSync, writeFileSync } from 'fs'

await activate('ns_live_...')

const buffer = readFileSync('model.stl').buffer
const result = await generateSupports(buffer, {
  format: 'stl',
  margin: 0.2,
  angle: 45,
})

writeFileSync('supports.stl', Buffer.from(result.stl))
console.log(result.stats) // { pieces, faces, volume }
```

`generateSupports()` will throw if called without activation or if the free tier is exhausted. `result.supportPieces` contains individual `ParsedMesh` objects for custom export or 3MF packaging.

## Documentation

Full docs at [negative.support/docs](https://negative.support/docs).

## Development

```bash
git clone --recurse-submodules https://github.com/drcmda/negative-support
npm install
npm run dev               # Frontend dev server on :5173
npm run dev:server        # API dev server on :8787
npm test                  # Full test suite
npm run build             # Build frontend
npm run deploy            # Build frontend + deploy to Cloudflare
```

## License

See [negative.support](https://negative.support) for licensing details.
