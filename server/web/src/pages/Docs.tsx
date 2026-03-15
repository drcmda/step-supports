export default function Docs() {
  return (
    <div className="py-16">
      <div className="max-w-[1100px] mx-auto px-6">
        <p className="label-xs mb-4 tracking-[0.14em]">Reference</p>
        <h1 className="text-2xl font-semibold mb-12 tracking-[-0.01em]">Documentation</h1>

        {/* Install */}
        <section className="mb-14">
          <div className="flex items-center gap-3 mb-5 pt-5 border-t border-border">
            <h2 className="text-lg font-medium">Installation</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4 max-sm:grid-cols-1">
            <div className="rounded-xl p-5 glass">
              <p className="label-xs mb-3">npm</p>
              <div className="bg-base/60 border border-border rounded-md px-3 py-2.5 mb-3 overflow-x-auto">
                <code className="font-mono text-xs text-accent whitespace-pre">npm install -g negative-support</code>
              </div>
              <p className="text-dim text-sm mb-3 leading-relaxed">
                Or run directly with npx (no install needed):
              </p>
              <div className="bg-base/60 border border-border rounded-md px-3 py-2.5 overflow-x-auto">
                <code className="font-mono text-xs text-accent whitespace-pre">npx negative-support model.stl</code>
              </div>
            </div>
            <div className="rounded-xl p-5 glass">
              <p className="label-xs mb-3">pip</p>
              <div className="bg-base/60 border border-border rounded-md px-3 py-2.5 mb-3 overflow-x-auto">
                <code className="font-mono text-xs text-accent whitespace-pre">pip install negative-support</code>
              </div>
              <p className="text-dim text-sm mb-3 leading-relaxed">
                For STEP file support (B-Rep overhang detection):
              </p>
              <div className="bg-base/60 border border-border rounded-md px-3 py-2.5 overflow-x-auto">
                <code className="font-mono text-xs text-accent whitespace-pre">pip install negative-support[step]</code>
              </div>
            </div>
          </div>
          <p className="text-muted text-xs font-mono">Requires Node.js 18+ (npm) or Python 3.10+ (pip).</p>
        </section>

        {/* Quick start */}
        <section className="mb-14">
          <div className="flex items-center gap-3 mb-5 pt-5 border-t border-border">
            <h2 className="text-lg font-medium">Quick start</h2>
          </div>
          <p className="text-dim text-sm mb-4 leading-relaxed">
            Both CLIs work the same way with the same arguments and output formats.
          </p>
          <div className="bg-base/60 border border-border rounded-lg px-4 py-3.5 mb-4 overflow-x-auto">
            <code className="font-mono text-xs text-accent whitespace-pre leading-relaxed">
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
          <p className="text-dim text-sm leading-relaxed">
            Outputs a <code className="font-mono text-[11px] bg-surface px-1.5 py-0.5 rounded text-primary/70">*_supports.stl</code> file (and optionally
            a <code className="font-mono text-[11px] bg-surface px-1.5 py-0.5 rounded text-primary/70">.3mf</code>) that you import alongside your model in your slicer.
          </p>
        </section>

        {/* CLI reference */}
        <section className="mb-14">
          <div className="flex items-center gap-3 mb-5 pt-5 border-t border-border">
            <h2 className="text-lg font-medium">CLI reference</h2>
          </div>
          <p className="text-dim text-sm mb-4 leading-relaxed">
            Both <code className="font-mono text-[11px] bg-surface px-1.5 py-0.5 rounded text-primary/70">npx negative-support</code> and{" "}
            <code className="font-mono text-[11px] bg-surface px-1.5 py-0.5 rounded text-primary/70">negative-support</code> (pip) accept the same flags:
          </p>
          <div className="rounded-xl overflow-hidden border border-border">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface">
                  <th className="text-left px-4 py-2.5 label-xs !text-muted">Flag</th>
                  <th className="text-left px-4 py-2.5 label-xs !text-muted">Default</th>
                  <th className="text-left px-4 py-2.5 label-xs !text-muted">Description</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {[
                  ["-o, --output", "*_supports.stl", "Output file path"],
                  ["-m, --margin", "0.2", "Gap between supports and model (mm)"],
                  ["--min-volume", "1.0", "Discard support pieces smaller than this (mm³)"],
                  ["-a, --angle", "45", "Overhang angle threshold in degrees (STEP only)"],
                  ["--3mf", "—", "Export 3MF with model + supports"],
                  ["-q, --quiet", "—", "Suppress progress display"],
                  ["--version", "—", "Show version"],
                  ["--status", "—", "Show license status"],
                  ["--buy", "—", "Open purchase page"],
                  ["--activate <token>", "—", "Activate license token"],
                ].map(([flag, def, desc]) => (
                  <tr key={flag} className="border-t border-border hover:bg-surface-bright transition-colors">
                    <td className="px-4 py-2.5"><code className="font-mono text-[11px] text-primary/70">{flag}</code></td>
                    <td className="px-4 py-2.5"><code className="font-mono text-[11px] text-dim">{def}</code></td>
                    <td className="px-4 py-2.5 text-dim text-sm">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 3MF export */}
        <section className="mb-14">
          <div className="flex items-center gap-3 mb-5 pt-5 border-t border-border">
            <h2 className="text-lg font-medium">3MF export</h2>
          </div>
          <p className="text-dim text-sm mb-4 leading-relaxed">
            The <code className="font-mono text-[11px] bg-surface px-1.5 py-0.5 rounded text-primary/70">--3mf</code> flag produces a 3MF file containing both
            your model and supports as separate objects. This is the recommended way to import into your slicer.
          </p>
          <div className="bg-base/60 border border-border rounded-lg px-4 py-3.5 mb-4 overflow-x-auto">
            <code className="font-mono text-xs text-accent whitespace-pre leading-relaxed">
              {`negative-support model.stl --3mf
# → model_supports.stl
# → model.3mf`}
            </code>
          </div>
          <p className="text-dim text-sm leading-relaxed">
            The 3MF file includes slicer presets for the support object
            (1 wall, 15% cubic infill) compatible with BambuStudio, OrcaSlicer,
            and PrusaSlicer.
          </p>
        </section>

        {/* npm API reference */}
        <section className="mb-14">
          <div className="flex items-center gap-3 mb-5 pt-5 border-t border-border">
            <h2 className="text-lg font-medium">npm API reference</h2>
          </div>
          <p className="text-dim text-sm mb-4 leading-relaxed">You can also use negative-support as a library:</p>
          <div className="bg-base/60 border border-border rounded-lg px-4 py-3.5 mb-4 overflow-x-auto">
            <code className="font-mono text-xs text-accent whitespace-pre leading-relaxed">
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

          <h3 className="text-base font-medium mt-6 mb-3">GenerateOptions</h3>
          <div className="rounded-xl overflow-hidden border border-border">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface">
                  <th className="text-left px-4 py-2.5 label-xs !text-muted">Property</th>
                  <th className="text-left px-4 py-2.5 label-xs !text-muted">Type</th>
                  <th className="text-left px-4 py-2.5 label-xs !text-muted">Default</th>
                  <th className="text-left px-4 py-2.5 label-xs !text-muted">Description</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {[
                  ["format", "string", "auto-detect", "File format: 'stl', 'obj', 'step', or 'stp'"],
                  ["margin", "number", "0.2", "Gap between supports and model (mm)"],
                  ["angle", "number", "45", "Overhang angle threshold (STEP only)"],
                  ["minVolume", "number", "1.0", "Discard pieces smaller than this (mm³)"],
                  ["onProgress", "(step, detail?) => void", "—", "Progress callback for each stage"],
                ].map(([prop, type, def, desc]) => (
                  <tr key={prop} className="border-t border-border hover:bg-surface-bright transition-colors">
                    <td className="px-4 py-2.5"><code className="font-mono text-[11px] text-primary/70">{prop}</code></td>
                    <td className="px-4 py-2.5"><code className="font-mono text-[11px] text-dim">{type}</code></td>
                    <td className="px-4 py-2.5"><code className="font-mono text-[11px] text-dim">{def}</code></td>
                    <td className="px-4 py-2.5 text-dim text-sm">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="text-base font-medium mt-6 mb-3">SupportResult</h3>
          <div className="rounded-xl overflow-hidden border border-border">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface">
                  <th className="text-left px-4 py-2.5 label-xs !text-muted">Property</th>
                  <th className="text-left px-4 py-2.5 label-xs !text-muted">Type</th>
                  <th className="text-left px-4 py-2.5 label-xs !text-muted">Description</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {[
                  ["stl", "ArrayBuffer", "Binary STL of the generated supports"],
                  ["stats.pieces", "number", "Number of separate support pieces"],
                  ["stats.faces", "number", "Total triangle count"],
                  ["stats.volume", "number", "Total support volume (mm³)"],
                ].map(([prop, type, desc]) => (
                  <tr key={prop} className="border-t border-border hover:bg-surface-bright transition-colors">
                    <td className="px-4 py-2.5"><code className="font-mono text-[11px] text-primary/70">{prop}</code></td>
                    <td className="px-4 py-2.5"><code className="font-mono text-[11px] text-dim">{type}</code></td>
                    <td className="px-4 py-2.5 text-dim text-sm">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Python API */}
        <section className="mb-14">
          <div className="flex items-center gap-3 mb-5 pt-5 border-t border-border">
            <h2 className="text-lg font-medium">Python API</h2>
          </div>
          <p className="text-dim text-sm mb-4 leading-relaxed">You can also use negative-support as a Python library:</p>
          <div className="bg-base/60 border border-border rounded-lg px-4 py-3.5 mb-4 overflow-x-auto">
            <code className="font-mono text-xs text-accent whitespace-pre leading-relaxed">
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
        <section className="mb-14">
          <div className="flex items-center gap-3 mb-5 pt-5 border-t border-border">
            <h2 className="text-lg font-medium">License management</h2>
          </div>
          <p className="text-dim text-sm mb-4 leading-relaxed">
            negative-support includes 3 free runs per machine. After that, a
            lifetime license is required.
          </p>
          <div className="bg-base/60 border border-border rounded-lg px-4 py-3.5 mb-4 overflow-x-auto">
            <code className="font-mono text-xs text-accent whitespace-pre leading-relaxed">
              {`# Check license status
negative-support --status

# Purchase a license (opens browser)
negative-support --buy

# Activate your token after purchase
negative-support --activate ns_live_your_token_here`}
            </code>
          </div>
          <p className="text-dim text-sm leading-relaxed">
            License state is shared between npm and pip on the same machine.
          </p>
        </section>
      </div>
    </div>
  );
}
