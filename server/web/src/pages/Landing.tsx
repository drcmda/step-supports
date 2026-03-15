import { useState } from "react";

export default function Landing() {
  const [loading, setLoading] = useState(false);

  const handleBuy = async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await resp.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      alert("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Hero */}
      <section className="py-25 pb-20 text-center">
        <div className="max-w-[960px] mx-auto px-6">
          <h1 className="text-[2.8rem] font-bold leading-[1.15] mb-4">
            Negative-space 3D print supports
          </h1>
          <p className="text-lg text-dim max-w-[560px] mx-auto mb-8">
            Generate precision support structures that fit perfectly around your
            model. Use it in your browser, or install via npm or pip.
          </p>
          <div className="flex gap-3 justify-center">
            <a
              href="/try"
              className="inline-block px-6 py-2.5 rounded-lg text-[0.95rem] font-medium no-underline bg-blue-500 text-white hover:bg-blue-600 transition-all"
            >
              Generate now
            </a>
            <a
              href="/docs"
              className="inline-block px-6 py-2.5 rounded-lg text-[0.95rem] font-medium no-underline bg-surface text-primary border border-border hover:border-dim transition-all"
            >
              Documentation
            </a>
            <a
              href="#pricing"
              className="inline-block px-6 py-2.5 rounded-lg text-[0.95rem] font-medium no-underline bg-surface text-primary border border-border hover:border-dim transition-all"
            >
              Pricing
            </a>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-base-alt">
        <div className="max-w-[1080px] mx-auto px-6">
          <h2 className="text-center mb-12 text-3xl">Get started</h2>
          <div className="grid grid-cols-[1fr_1.4fr_1fr] gap-6 max-sm:grid-cols-1">
            <div className="bg-surface border border-border rounded-xl p-6 min-w-0">
              <h3 className="text-lg mb-2">Browser</h3>
              <p className="text-dim text-sm mb-3">
                Upload a file and generate supports instantly. No install
                needed.
              </p>
              <div className="bg-base border border-border rounded-lg px-3 py-2.5 mb-3 overflow-x-auto min-w-0">
                <code className="font-mono text-xs text-green-500 whitespace-pre">STL, OBJ, STEP</code>
              </div>
              <a href="/try" className="text-blue-500 text-sm no-underline hover:underline">
                Open generator &rarr;
              </a>
            </div>
            <div className="bg-surface border border-border rounded-xl p-6 min-w-0">
              <h3 className="text-lg mb-2">npm</h3>
              <div className="bg-base border border-border rounded-lg px-3 py-2.5 mb-3 overflow-x-auto min-w-0">
                <code className="font-mono text-xs text-green-500 whitespace-pre">npx negative-support model.stl</code>
              </div>
              <div className="bg-base border border-border rounded-lg px-3 py-2.5 mb-3 overflow-x-auto min-w-0">
                <code className="font-mono text-xs text-green-500 whitespace-pre">npx negative-support model.step --3mf</code>
              </div>
              <a
                href="https://www.npmjs.com/package/negative-support"
                className="text-blue-500 text-sm no-underline hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                View on npm &rarr;
              </a>
            </div>
            <div className="bg-surface border border-border rounded-xl p-6 min-w-0">
              <h3 className="text-lg mb-2">pip</h3>
              <div className="bg-base border border-border rounded-lg px-3 py-2.5 mb-3 overflow-x-auto min-w-0">
                <code className="font-mono text-xs text-green-500 whitespace-pre">pip install negative-support</code>
              </div>
              <div className="bg-base border border-border rounded-lg px-3 py-2.5 mb-3 overflow-x-auto min-w-0">
                <code className="font-mono text-xs text-green-500 whitespace-pre">negative-support model.stl</code>
              </div>
              <a href="/docs" className="text-blue-500 text-sm no-underline hover:underline">
                Read the docs &rarr;
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="max-w-[960px] mx-auto px-6">
          <h2 className="text-center mb-12 text-3xl">Features</h2>
          <div className="grid grid-cols-2 gap-6 max-sm:grid-cols-1">
            <div className="bg-surface border border-border rounded-xl p-6">
              <h3 className="mb-2 text-base">STEP overhang detection</h3>
              <p className="text-dim text-sm">
                Uses B-Rep face topology to detect exactly which surfaces need
                support. Only generates supports where needed.
              </p>
            </div>
            <div className="bg-surface border border-border rounded-xl p-6">
              <h3 className="mb-2 text-base">Mesh full-shell mode</h3>
              <p className="text-dim text-sm">
                Works with STL and OBJ files. Creates complete negative-space
                supports around the entire model.
              </p>
            </div>
            <div className="bg-surface border border-border rounded-xl p-6">
              <h3 className="mb-2 text-base">Precision gap control</h3>
              <p className="text-dim text-sm">
                Configurable margin between supports and model (default 0.2mm).
                Supports snap off cleanly after printing.
              </p>
            </div>
            <div className="bg-surface border border-border rounded-xl p-6">
              <h3 className="mb-2 text-base">Cross-platform</h3>
              <p className="text-dim text-sm">
                Same algorithm on all platforms. Browser, Node.js, and Python
                produce identical results.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 bg-base-alt" id="pricing">
        <div className="max-w-[960px] mx-auto px-6">
          <h2 className="text-center mb-12 text-3xl">Pricing</h2>
          <div className="grid grid-cols-2 gap-6 max-w-[640px] mx-auto max-sm:grid-cols-1">
            <div className="bg-surface border border-border rounded-xl p-8 text-center">
              <h3 className="mb-3 text-xl">Free</h3>
              <div className="text-4xl font-bold mb-6">$0</div>
              <ul className="list-none mb-6">
                <li className="py-1.5 text-dim text-sm before:content-['\2713\00a0\00a0'] before:text-green-500">3 runs per machine</li>
                <li className="py-1.5 text-dim text-sm before:content-['\2713\00a0\00a0'] before:text-green-500">All features included</li>
                <li className="py-1.5 text-dim text-sm before:content-['\2713\00a0\00a0'] before:text-green-500">No account needed</li>
              </ul>
              <a
                href="/docs"
                className="inline-block px-6 py-2.5 rounded-lg text-[0.95rem] font-medium no-underline bg-surface text-primary border border-border hover:border-dim transition-all"
              >
                Get started
              </a>
            </div>
            <div className="bg-surface border border-blue-500 rounded-xl p-8 text-center">
              <h3 className="mb-3 text-xl">Lifetime</h3>
              <div className="text-4xl font-bold mb-6">
                $29 <span className="text-sm font-normal text-dim">one-time</span>
              </div>
              <ul className="list-none mb-6">
                <li className="py-1.5 text-dim text-sm before:content-['\2713\00a0\00a0'] before:text-green-500">Unlimited runs</li>
                <li className="py-1.5 text-dim text-sm before:content-['\2713\00a0\00a0'] before:text-green-500">Up to 3 machines</li>
                <li className="py-1.5 text-dim text-sm before:content-['\2713\00a0\00a0'] before:text-green-500">All future updates</li>
              </ul>
              <button
                className="inline-block px-6 py-2.5 rounded-lg text-[0.95rem] font-medium bg-blue-500 text-white border-none cursor-pointer hover:bg-blue-600 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={handleBuy}
                disabled={loading}
              >
                {loading ? "Redirecting..." : "Buy now"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
