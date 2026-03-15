export default function Docs() {
  return (
    <div className="docs-page">
      <div className="container">
        <h1>Documentation</h1>

        {/* Install */}
        <section>
          <h2>Installation</h2>
          <p>Requires Python 3.10+.</p>
          <div className="code-block">
            <code>pip install negative-support</code>
          </div>
          <p>
            For STEP file support (B-Rep overhang detection), install the
            optional dependency:
          </p>
          <div className="code-block">
            <code>pip install negative-support[step]</code>
          </div>
        </section>

        {/* Quick start */}
        <section>
          <h2>Quick start</h2>
          <h3>Mesh mode (STL, OBJ, PLY, 3MF)</h3>
          <p>
            Generates full-shell supports — the entire negative space around the
            model. Works with any mesh format.
          </p>
          <div className="code-block">
            <code>negative-support model.stl</code>
          </div>
          <h3>STEP mode</h3>
          <p>
            Uses B-Rep face topology to detect overhang surfaces and generate
            supports only where needed.
          </p>
          <div className="code-block">
            <code>negative-support model.step</code>
          </div>
          <p>
            Both modes output a <code>*_supports.stl</code> file that you
            import alongside your model in your slicer.
          </p>
        </section>

        {/* CLI reference */}
        <section>
          <h2>CLI reference</h2>
          <table className="cli-table">
            <thead>
              <tr>
                <th>Flag</th>
                <th>Default</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>-o, --output</code>
                </td>
                <td>
                  <code>*_supports.stl</code>
                </td>
                <td>Output file path</td>
              </tr>
              <tr>
                <td>
                  <code>-m, --margin</code>
                </td>
                <td>
                  <code>0.2</code>
                </td>
                <td>Gap between supports and model (mm)</td>
              </tr>
              <tr>
                <td>
                  <code>--min-volume</code>
                </td>
                <td>
                  <code>1.0</code>
                </td>
                <td>
                  Discard support pieces smaller than this (mm<sup>3</sup>)
                </td>
              </tr>
              <tr>
                <td>
                  <code>-a, --angle</code>
                </td>
                <td>
                  <code>45</code>
                </td>
                <td>Overhang angle threshold in degrees (STEP only)</td>
              </tr>
              <tr>
                <td>
                  <code>--tolerance</code>
                </td>
                <td>
                  <code>0.01</code>
                </td>
                <td>Tessellation tolerance in mm (STEP only)</td>
              </tr>
              <tr>
                <td>
                  <code>-e, --export-model</code>
                </td>
                <td>&mdash;</td>
                <td>Also export the STEP model as STL</td>
              </tr>
              <tr>
                <td>
                  <code>-q, --quiet</code>
                </td>
                <td>&mdash;</td>
                <td>Suppress progress display</td>
              </tr>
              <tr>
                <td>
                  <code>--debug</code>
                </td>
                <td>&mdash;</td>
                <td>Print detailed per-face diagnostics</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* License */}
        <section>
          <h2>License management</h2>
          <p>
            negative-support includes 3 free runs. After that, a license is
            required.
          </p>
          <div className="code-block">
            <code>
              {`# Check license status
negative-support --status

# Purchase a license (opens browser)
negative-support --buy

# Activate your token after purchase
negative-support --activate ns_live_your_token_here`}
            </code>
          </div>
        </section>

        {/* Python API */}
        <section>
          <h2>Python API</h2>
          <p>You can also use negative-support as a library:</p>
          <div className="code-block">
            <code>
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
      </div>
    </div>
  );
}
