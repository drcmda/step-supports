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
      <section className="pt-28 pb-24 text-center relative overflow-hidden">
        {/* Subtle radial glow behind hero */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 600px 400px at 50% 0%, rgba(34,197,94,0.04) 0%, transparent 70%)" }} />
        <div className="max-w-[1100px] mx-auto px-6 relative">
          <p className="label-xs mb-6 tracking-[0.14em]">3D print support generator</p>
          <h1 className="text-[3.2rem] font-semibold leading-[1.08] mb-5 tracking-[-0.02em] max-w-[720px] mx-auto">
            Negative-space supports that{" "}
            <span className="text-accent">fit perfectly</span>
          </h1>
          <p className="text-[1.05rem] text-dim max-w-[520px] mx-auto mb-10 leading-relaxed">
            Generate precision support structures around your model.
            Browser, npm, or pip — same algorithm everywhere.
          </p>
          <div className="flex gap-3 justify-center">
            <a
              href="/generate"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium no-underline bg-accent text-base transition-all hover:brightness-110 glow-accent"
            >
              Generate now
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-60"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </a>
            <a
              href="/docs"
              className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-medium no-underline glass glass-hover text-primary/70"
            >
              Documentation
            </a>
          </div>
        </div>
      </section>

      {/* Install strip */}
      <section className="border-y border-border bg-base-alt">
        <div className="max-w-[1100px] mx-auto px-6 grid grid-cols-3 max-md:grid-cols-1 divide-x max-md:divide-x-0 max-md:divide-y divide-border">
          {/* Browser */}
          <div className="py-8 px-6 first:pl-0 last:pr-0 max-md:px-0 max-md:first:pt-8">
            <p className="label-xs mb-3">Browser</p>
            <p className="text-dim text-sm mb-3 leading-relaxed">Upload and generate instantly. No install needed.</p>
            <div className="bg-base/60 border border-border rounded-md px-3 py-2 mb-3 overflow-x-auto">
              <code className="font-mono text-xs text-code whitespace-pre">STL, OBJ, STEP</code>
            </div>
            <a href="/generate" className="font-mono text-[11px] tracking-[0.06em] text-pink/60 no-underline hover:text-pink transition-colors">
              Open generator &rarr;
            </a>
          </div>
          {/* npm */}
          <div className="py-8 px-6 max-md:px-0">
            <p className="label-xs mb-3">npm</p>
            <div className="bg-base/60 border border-border rounded-md px-3 py-2 mb-2 overflow-x-auto">
              <code className="font-mono text-xs text-code whitespace-pre">npx negative-support model.stl</code>
            </div>
            <div className="bg-base/60 border border-border rounded-md px-3 py-2 mb-3 overflow-x-auto">
              <code className="font-mono text-xs text-code whitespace-pre">npx negative-support model.step --3mf</code>
            </div>
            <a
              href="https://www.npmjs.com/package/negative-support"
              className="font-mono text-[11px] tracking-[0.06em] text-pink/60 no-underline hover:text-pink transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              View on npm &rarr;
            </a>
          </div>
          {/* pip */}
          <div className="py-8 px-6 last:pr-0 max-md:px-0 max-md:last:pb-8">
            <p className="label-xs mb-3">pip</p>
            <div className="bg-base/60 border border-border rounded-md px-3 py-2 mb-2 overflow-x-auto">
              <code className="font-mono text-xs text-code whitespace-pre">pip install negative-support</code>
            </div>
            <div className="bg-base/60 border border-border rounded-md px-3 py-2 mb-3 overflow-x-auto">
              <code className="font-mono text-xs text-code whitespace-pre">negative-support model.stl</code>
            </div>
            <a href="/docs" className="font-mono text-[11px] tracking-[0.06em] text-pink/60 no-underline hover:text-pink transition-colors">
              Read the docs &rarr;
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24">
        <div className="max-w-[1100px] mx-auto px-6">
          <p className="label-xs mb-4 text-center tracking-[0.14em]">Capabilities</p>
          <h2 className="text-center mb-14 text-2xl font-semibold tracking-[-0.01em]">Built for precision printing</h2>
          <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            {[
              { title: "STEP overhang detection", desc: "Uses B-Rep face topology to detect exactly which surfaces need support. Only generates supports where needed." },
              { title: "Mesh full-shell mode", desc: "Works with STL and OBJ files. Creates complete negative-space supports around the entire model." },
              { title: "Precision gap control", desc: "Configurable margin between supports and model (default 0.2mm). Supports snap off cleanly after printing." },
              { title: "Cross-platform", desc: "Same algorithm on all platforms. Browser, Node.js, and Python produce identical results." },
            ].map((f) => (
              <div key={f.title} className="rounded-xl p-6 glass glass-hover group">
                <h3 className="text-[0.95rem] font-medium mb-2 text-primary/80 group-hover:text-primary transition-colors">{f.title}</h3>
                <p className="text-dim text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 border-t border-border" id="pricing">
        <div className="max-w-[1100px] mx-auto px-6">
          <p className="label-xs mb-4 text-center tracking-[0.14em]">Pricing</p>
          <h2 className="text-center mb-14 text-2xl font-semibold tracking-[-0.01em]">Simple, one-time pricing</h2>
          <div className="grid grid-cols-2 gap-4 max-w-[580px] mx-auto max-sm:grid-cols-1">
            {/* Free */}
            <div className="rounded-xl p-7 glass text-center">
              <p className="label-xs mb-5">Free tier</p>
              <div className="font-pixel text-[3rem] leading-none mb-1 text-primary/60">$0</div>
              <p className="text-dim text-xs mb-6">forever</p>
              <ul className="list-none mb-7 space-y-2.5">
                <li className="text-dim text-sm flex items-center gap-2 justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-accent shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                  3 runs per machine
                </li>
                <li className="text-dim text-sm flex items-center gap-2 justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-accent shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                  All features included
                </li>
                <li className="text-dim text-sm flex items-center gap-2 justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-accent shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                  No account needed
                </li>
              </ul>
              <a
                href="/docs"
                className="inline-flex items-center px-5 py-2 rounded-lg text-sm font-medium no-underline glass glass-hover text-primary/70"
              >
                Get started
              </a>
            </div>
            {/* Lifetime */}
            <div className="rounded-xl p-7 text-center border border-accent/20 bg-[rgba(255,255,255,0.02)] relative overflow-hidden animate-glow-pulse">
              <p className="label-xs mb-5 text-pink/50">Lifetime</p>
              <div className="font-pixel text-[3rem] leading-none mb-1 text-pink">$29</div>
              <p className="text-dim text-xs mb-6">one-time payment</p>
              <ul className="list-none mb-7 space-y-2.5">
                <li className="text-dim text-sm flex items-center gap-2 justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-accent shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                  Unlimited runs
                </li>
                <li className="text-dim text-sm flex items-center gap-2 justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-accent shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                  Up to 3 machines
                </li>
                <li className="text-dim text-sm flex items-center gap-2 justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-accent shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                  All future updates
                </li>
              </ul>
              <button
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-accent text-base border-none cursor-pointer hover:brightness-110 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={handleBuy}
                disabled={loading}
              >
                {loading ? "Redirecting..." : "Buy now"}
                {!loading && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-60"><path d="M5 12h14M12 5l7 7-7 7"/></svg>}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
