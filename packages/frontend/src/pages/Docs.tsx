export default function Docs() {
  return (
    <div className="py-16">
      <div className="max-w-[1200px] mx-auto px-6">
        <p className="label-xs mb-4 tracking-[0.14em]">Reference</p>
        <h1 className="text-2xl font-semibold mb-12 tracking-[-0.01em]">Documentation</h1>

        {/* Install */}
        <section className="mb-14">
          <div className="flex items-center gap-3 mb-5 pt-5 border-t border-border">
            <h2 className="text-lg font-medium">1. Install</h2>
          </div>
          <div className="rounded-xl p-5 glass mb-4">
            <p className="label-xs mb-3">npm</p>
            <div className="bg-base/60 border border-border rounded-md px-3 py-2.5 mb-3 overflow-x-auto">
              <code className="font-mono text-xs text-code whitespace-pre">npm install -g negative-support</code>
            </div>
            <p className="text-dim text-sm mb-3 leading-relaxed">
              Or run directly with npx (no install needed):
            </p>
            <div className="bg-base/60 border border-border rounded-md px-3 py-2.5 overflow-x-auto">
              <code className="font-mono text-xs text-code whitespace-pre">npx negative-support model.stl</code>
            </div>
          </div>
          <p className="text-muted text-xs font-mono">Requires Node.js 18+.</p>
        </section>

        {/* Activate */}
        <section className="mb-14">
          <div className="flex items-center gap-3 mb-5 pt-5 border-t border-border">
            <h2 className="text-lg font-medium">2. Activate</h2>
          </div>
          <p className="text-dim text-sm mb-4 leading-relaxed">
            The CLI requires a license token. Sign in at{" "}
            <a href="/" className="text-accent no-underline hover:underline">negative.support</a> to
            get yours, then activate it:
          </p>
          <div className="bg-base/60 border border-border rounded-lg px-4 py-3.5 mb-4 overflow-x-auto">
            <code className="font-mono text-xs text-code whitespace-pre leading-relaxed">
              {`negative-support --activate <your-token>`}
            </code>
          </div>
          <p className="text-dim text-sm mb-4 leading-relaxed">
            You can find your token in the user menu after signing in. It works on up to 3 machines
            and is shared across machines.
          </p>
          <div className="rounded-xl p-5 glass">
            <div className="flex items-start gap-4 max-sm:flex-col">
              <div className="flex-1">
                <p className="label-xs mb-2">Free tier</p>
                <p className="text-dim text-sm leading-relaxed">
                  Every account starts with 10 free runs. No credit card needed.
                  Once exhausted, buy a lifetime license to continue — your
                  existing token is automatically upgraded, no re-activation needed.
                </p>
              </div>
              <div className="flex-1">
                <p className="label-xs mb-2">Lifetime license</p>
                <p className="text-dim text-sm leading-relaxed">
                  One-time purchase, unlimited runs forever.
                  Works on up to 3 machines with the same token.{" "}
                  <a href="/#pricing" className="text-accent no-underline hover:underline">See pricing</a>.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Quick start */}
        <section className="mb-14">
          <div className="flex items-center gap-3 mb-5 pt-5 border-t border-border">
            <h2 className="text-lg font-medium">3. Use</h2>
          </div>
          <p className="text-dim text-sm mb-4 leading-relaxed">
            The CLI accepts the following arguments and output formats.
          </p>
          <div className="bg-base/60 border border-border rounded-lg px-4 py-3.5 mb-4 overflow-x-auto">
            <code className="font-mono text-xs text-code whitespace-pre leading-relaxed">
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
            <code className="font-mono text-[11px] bg-surface px-1.5 py-0.5 rounded text-primary/70">npx negative-support</code> accepts the following flags:
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
                  ["--min-volume", "1.0", "Discard support pieces smaller than this (mm\u00b3)"],
                  ["-a, --angle", "45", "Overhang angle threshold in degrees (STEP only)"],
                  ["--3mf", "\u2014", "Export 3MF with model + supports"],
                  ["-q, --quiet", "\u2014", "Suppress progress display"],
                  ["--version", "\u2014", "Show version"],
                  ["--status", "\u2014", "Show license status"],
                  ["--activate <token>", "\u2014", "Activate license token"],
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
            <code className="font-mono text-xs text-code whitespace-pre leading-relaxed">
              {`negative-support model.stl --3mf
# \u2192 model_supports.stl
# \u2192 model.3mf`}
            </code>
          </div>
          <p className="text-dim text-sm leading-relaxed">
            The 3MF file includes slicer presets for the support object
            (1 wall, 10% cubic infill) compatible with BambuStudio, OrcaSlicer,
            and PrusaSlicer.
          </p>
        </section>

        {/* npm API reference */}
        <section className="mb-14">
          <div className="flex items-center gap-3 mb-5 pt-5 border-t border-border">
            <h2 className="text-lg font-medium">npm API reference</h2>
          </div>
          <p className="text-dim text-sm mb-4 leading-relaxed">
            You can also use negative-support as a library. Call{" "}
            <code className="font-mono text-[11px] bg-surface px-1.5 py-0.5 rounded text-primary/70">activate()</code>{" "}
            with your license token before generating:
          </p>
          <div className="bg-base/60 border border-border rounded-lg px-4 py-3.5 mb-4 overflow-x-auto">
            <code className="font-mono text-xs text-code whitespace-pre leading-relaxed">
              {`import { generateSupports, activate } from 'negative-support'
import { readFileSync, writeFileSync } from 'fs'

await activate('ns_live_...')

const buffer = readFileSync('model.stl').buffer
const result = await generateSupports(buffer, {
  format: 'stl',
  margin: 0.2,
})

writeFileSync('model_supports.stl', Buffer.from(result.stl))
console.log(result.stats) // { pieces, faces, volume }`}
            </code>
          </div>
          <p className="text-dim text-sm mb-4 leading-relaxed">
            The token is the same one you use for the CLI. Get it from the user menu after signing in
            at <a href="/" className="text-accent no-underline hover:underline">negative.support</a>.
            Calling <code className="font-mono text-[11px] bg-surface px-1.5 py-0.5 rounded text-primary/70">generateSupports()</code> without
            activation will throw.
          </p>

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
                  ["minVolume", "number", "1.0", "Discard pieces smaller than this (mm\u00b3)"],
                  ["onProgress", "(step, detail?) => void", "\u2014", "Progress callback for each stage"],
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
                  ["stats.volume", "number", "Total support volume (mm\u00b3)"],
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

      </div>
    </div>
  );
}
