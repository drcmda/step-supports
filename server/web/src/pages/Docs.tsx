export default function Docs() {
  return (
    <div className="py-15">
      <div className="max-w-[960px] mx-auto px-6">
        <h1 className="text-3xl mb-10">Documentation</h1>

        {/* Install */}
        <section className="mb-12">
          <h2 className="text-xl mb-4 pt-4 border-t border-border">Installation</h2>
          <div className="grid grid-cols-2 gap-6 mb-4 max-sm:grid-cols-1">
            <div>
              <h3 className="text-base mb-2">npm</h3>
              <div className="bg-surface border border-border rounded-lg p-4 my-3 overflow-x-auto">
                <code className="font-mono text-sm text-green-500 whitespace-pre">npm install -g negative-support</code>
              </div>
              <p className="text-dim mb-3">
                Or run directly with npx (no install needed):
              </p>
              <div className="bg-surface border border-border rounded-lg p-4 my-3 overflow-x-auto">
                <code className="font-mono text-sm text-green-500 whitespace-pre">npx negative-support model.stl</code>
              </div>
            </div>
            <div>
              <h3 className="text-base mb-2">pip</h3>
              <div className="bg-surface border border-border rounded-lg p-4 my-3 overflow-x-auto">
                <code className="font-mono text-sm text-green-500 whitespace-pre">pip install negative-support</code>
              </div>
              <p className="text-dim mb-3">
                For STEP file support (B-Rep overhang detection):
              </p>
              <div className="bg-surface border border-border rounded-lg p-4 my-3 overflow-x-auto">
                <code className="font-mono text-sm text-green-500 whitespace-pre">pip install negative-support[step]</code>
              </div>
            </div>
          </div>
          <p className="text-dim mb-3">Requires Node.js 18+ (npm) or Python 3.10+ (pip).</p>
        </section>

        {/* Quick start */}
        <section className="mb-12">
          <h2 className="text-xl mb-4 pt-4 border-t border-border">Quick start</h2>
          <p className="text-dim mb-3">
            Both CLIs work the same way with the same arguments and output
            formats.
          </p>
          <div className="bg-surface border border-border rounded-lg p-4 my-3 overflow-x-auto">
            <code className="font-mono text-sm text-green-500 whitespace-pre">
              {`# Generate supports (STL output)
negative-support model.stl

# Generate supports with 3MF export (model + supports)
negative-support model.stl --3mf

# STEP mode (overhang detection)
negative-support model.step

# Custom margin and minimum volume
negative-support model.stl -m 0.3 --min-volume 2.0

# Specify output path
negative-support model.stl -o my_supports.stl`}
            </code>
          </div>
          <p className="text-dim mb-3">
            Outputs a <code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded">*_supports.stl</code> file (and optionally
            a <code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded">.3mf</code>) that you import alongside your model in your
            slicer.
          </p>
        </section>

        {/* CLI reference */}
        <section className="mb-12">
          <h2 className="text-xl mb-4 pt-4 border-t border-border">CLI reference</h2>
          <p className="text-dim mb-3">
            Both <code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded text-primary">npx negative-support</code> and{" "}
            <code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded text-primary">negative-support</code> (pip) accept the same flags:
          </p>
          <table className="w-full border-collapse my-3">
            <thead>
              <tr>
                <th className="text-left px-3 py-2.5 border-b border-border text-primary font-semibold text-xs uppercase tracking-wider">Flag</th>
                <th className="text-left px-3 py-2.5 border-b border-border text-primary font-semibold text-xs uppercase tracking-wider">Default</th>
                <th className="text-left px-3 py-2.5 border-b border-border text-primary font-semibold text-xs uppercase tracking-wider">Description</th>
              </tr>
            </thead>
            <tbody className="text-sm text-dim">
              <tr>
                <td className="px-3 py-2.5 border-b border-border"><code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded text-primary">-o, --output</code></td>
                <td className="px-3 py-2.5 border-b border-border"><code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded text-primary">*_supports.stl</code></td>
                <td className="px-3 py-2.5 border-b border-border">Output file path</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 border-b border-border"><code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded text-primary">-m, --margin</code></td>
                <td className="px-3 py-2.5 border-b border-border"><code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded text-primary">0.2</code></td>
                <td className="px-3 py-2.5 border-b border-border">Gap between supports and model (mm)</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 border-b border-border"><code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded text-primary">--min-volume</code></td>
                <td className="px-3 py-2.5 border-b border-border"><code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded text-primary">1.0</code></td>
                <td className="px-3 py-2.5 border-b border-border">Discard support pieces smaller than this (mm<sup>3</sup>)</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 border-b border-border"><code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded text-primary">-a, --angle</code></td>
                <td className="px-3 py-2.5 border-b border-border"><code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded text-primary">45</code></td>
                <td className="px-3 py-2.5 border-b border-border">Overhang angle threshold in degrees (STEP only)</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 border-b border-border"><code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded text-primary">--3mf</code></td>
                <td className="px-3 py-2.5 border-b border-border">&mdash;</td>
                <td className="px-3 py-2.5 border-b border-border">Export 3MF with model + supports</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 border-b border-border"><code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded text-primary">-q, --quiet</code></td>
                <td className="px-3 py-2.5 border-b border-border">&mdash;</td>
                <td className="px-3 py-2.5 border-b border-border">Suppress progress display</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 border-b border-border"><code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded text-primary">--version</code></td>
                <td className="px-3 py-2.5 border-b border-border">&mdash;</td>
                <td className="px-3 py-2.5 border-b border-border">Show version</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 border-b border-border"><code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded text-primary">--status</code></td>
                <td className="px-3 py-2.5 border-b border-border">&mdash;</td>
                <td className="px-3 py-2.5 border-b border-border">Show license status</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 border-b border-border"><code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded text-primary">--buy</code></td>
                <td className="px-3 py-2.5 border-b border-border">&mdash;</td>
                <td className="px-3 py-2.5 border-b border-border">Open purchase page</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 border-b border-border"><code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded text-primary">--activate &lt;token&gt;</code></td>
                <td className="px-3 py-2.5 border-b border-border">&mdash;</td>
                <td className="px-3 py-2.5 border-b border-border">Activate license token</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* 3MF export */}
        <section className="mb-12">
          <h2 className="text-xl mb-4 pt-4 border-t border-border">3MF export</h2>
          <p className="text-dim mb-3">
            The <code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded text-primary">--3mf</code> flag produces a 3MF file containing both
            your model and supports as separate objects. This is the recommended
            way to import into your slicer.
          </p>
          <div className="bg-surface border border-border rounded-lg p-4 my-3 overflow-x-auto">
            <code className="font-mono text-sm text-green-500 whitespace-pre">
              {`negative-support model.stl --3mf
# → model_supports.stl
# → model.3mf`}
            </code>
          </div>
          <p className="text-dim mb-3">
            The 3MF file includes slicer presets for the support object
            (1 wall, 15% cubic infill) compatible with BambuStudio, OrcaSlicer,
            and PrusaSlicer.
          </p>
        </section>

        {/* npm API reference */}
        <section className="mb-12">
          <h2 className="text-xl mb-4 pt-4 border-t border-border">npm API reference</h2>
          <p className="text-dim mb-3">You can also use negative-support as a library:</p>
          <div className="bg-surface border border-border rounded-lg p-4 my-3 overflow-x-auto">
            <code className="font-mono text-sm text-green-500 whitespace-pre">
              {`import { generateSupports } from 'negative-support'
import { readFileSync, writeFileSync } from 'fs'

const buffer = readFileSync('model.stl').buffer
const result = await generateSupports(buffer, {
  format: 'stl',
  margin: 0.2,
})

writeFileSync('model_supports.stl', Buffer.from(result.stl))
console.log(result.stats) // { pieces, faces, volume }`}
            </code>
          </div>

          <h3 className="text-lg mt-4 mb-2">GenerateOptions</h3>
          <table className="w-full border-collapse my-3">
            <thead>
              <tr>
                <th className="text-left px-3 py-2.5 border-b border-border text-primary font-semibold text-xs uppercase tracking-wider">Property</th>
                <th className="text-left px-3 py-2.5 border-b border-border text-primary font-semibold text-xs uppercase tracking-wider">Type</th>
                <th className="text-left px-3 py-2.5 border-b border-border text-primary font-semibold text-xs uppercase tracking-wider">Default</th>
                <th className="text-left px-3 py-2.5 border-b border-border text-primary font-semibold text-xs uppercase tracking-wider">Description</th>
              </tr>
            </thead>
            <tbody className="text-sm text-dim">
              <tr>
                <td className="px-3 py-2.5 border-b border-border"><code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded text-primary">format</code></td>
                <td className="px-3 py-2.5 border-b border-border"><code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded text-primary">string</code></td>
                <td className="px-3 py-2.5 border-b border-border">auto-detect</td>
                <td className="px-3 py-2.5 border-b border-border">File format: 'stl', 'obj', 'step', or 'stp'</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 border-b border-border"><code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded text-primary">margin</code></td>
                <td className="px-3 py-2.5 border-b border-border"><code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded text-primary">number</code></td>
                <td className="px-3 py-2.5 border-b border-border"><code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded text-primary">0.2</code></td>
                <td className="px-3 py-2.5 border-b border-border">Gap between supports and model (mm)</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 border-b border-border"><code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded text-primary">angle</code></td>
                <td className="px-3 py-2.5 border-b border-border"><code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded text-primary">number</code></td>
                <td className="px-3 py-2.5 border-b border-border"><code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded text-primary">45</code></td>
                <td className="px-3 py-2.5 border-b border-border">Overhang angle threshold in degrees (STEP only)</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 border-b border-border"><code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded text-primary">minVolume</code></td>
                <td className="px-3 py-2.5 border-b border-border"><code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded text-primary">number</code></td>
                <td className="px-3 py-2.5 border-b border-border"><code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded text-primary">1.0</code></td>
                <td className="px-3 py-2.5 border-b border-border">Discard support pieces smaller than this (mm<sup>3</sup>)</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 border-b border-border"><code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded text-primary">onProgress</code></td>
                <td className="px-3 py-2.5 border-b border-border"><code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded text-primary">(step, detail?) =&gt; void</code></td>
                <td className="px-3 py-2.5 border-b border-border">&mdash;</td>
                <td className="px-3 py-2.5 border-b border-border">Progress callback for each pipeline stage</td>
              </tr>
            </tbody>
          </table>

          <h3 className="text-lg mt-4 mb-2">SupportResult</h3>
          <table className="w-full border-collapse my-3">
            <thead>
              <tr>
                <th className="text-left px-3 py-2.5 border-b border-border text-primary font-semibold text-xs uppercase tracking-wider">Property</th>
                <th className="text-left px-3 py-2.5 border-b border-border text-primary font-semibold text-xs uppercase tracking-wider">Type</th>
                <th className="text-left px-3 py-2.5 border-b border-border text-primary font-semibold text-xs uppercase tracking-wider">Description</th>
              </tr>
            </thead>
            <tbody className="text-sm text-dim">
              <tr>
                <td className="px-3 py-2.5 border-b border-border"><code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded text-primary">stl</code></td>
                <td className="px-3 py-2.5 border-b border-border"><code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded text-primary">ArrayBuffer</code></td>
                <td className="px-3 py-2.5 border-b border-border">Binary STL of the generated supports</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 border-b border-border"><code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded text-primary">stats.pieces</code></td>
                <td className="px-3 py-2.5 border-b border-border"><code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded text-primary">number</code></td>
                <td className="px-3 py-2.5 border-b border-border">Number of separate support pieces</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 border-b border-border"><code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded text-primary">stats.faces</code></td>
                <td className="px-3 py-2.5 border-b border-border"><code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded text-primary">number</code></td>
                <td className="px-3 py-2.5 border-b border-border">Total triangle count</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 border-b border-border"><code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded text-primary">stats.volume</code></td>
                <td className="px-3 py-2.5 border-b border-border"><code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded text-primary">number</code></td>
                <td className="px-3 py-2.5 border-b border-border">Total support volume (mm³)</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Python API */}
        <section className="mb-12">
          <h2 className="text-xl mb-4 pt-4 border-t border-border">Python API</h2>
          <p className="text-dim mb-3">You can also use negative-support as a Python library:</p>
          <div className="bg-surface border border-border rounded-lg p-4 my-3 overflow-x-auto">
            <code className="font-mono text-sm text-green-500 whitespace-pre">
              {`from negative_support import load_step, compute_supports

# STEP file
part, z_offset = load_step("model.step")
supports = compute_supports(part, margin=0.2, angle=45.0)
supports.export("supports.stl")

# Mesh file
from negative_support import load_mesh, compute_supports_mesh

mesh, z_offset = load_mesh("model.stl")
supports = compute_supports_mesh(mesh, margin=0.2)
supports.export("supports.stl")`}
            </code>
          </div>
        </section>

        {/* License */}
        <section className="mb-12">
          <h2 className="text-xl mb-4 pt-4 border-t border-border">License management</h2>
          <p className="text-dim mb-3">
            negative-support includes 3 free runs per machine. After that, a
            lifetime license is required.
          </p>
          <div className="bg-surface border border-border rounded-lg p-4 my-3 overflow-x-auto">
            <code className="font-mono text-sm text-green-500 whitespace-pre">
              {`# Check license status
negative-support --status

# Purchase a license (opens browser)
negative-support --buy

# Activate your token after purchase
negative-support --activate ns_live_your_token_here`}
            </code>
          </div>
          <p className="text-dim mb-3">
            License state is shared between npm and pip on the same machine.
          </p>
        </section>
      </div>
    </div>
  );
}
