import { useState } from 'react'

export default function Landing() {
  const [loading, setLoading] = useState(false)

  const handleBuy = async () => {
    setLoading(true)
    try {
      const resp = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      })
      const data = await resp.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      alert('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Hero */}
      <section className='pt-28 pb-24 text-center relative overflow-hidden'>
        {/* Subtle radial glow behind hero */}
        <div
          className='absolute inset-0 pointer-events-none'
          style={{ background: 'radial-gradient(ellipse 600px 400px at 50% 0%, rgba(34,197,94,0.04) 0%, transparent 70%)' }}
        />
        <div className='max-w-[1100px] mx-auto px-6 relative'>
          <p className='label-xs mb-6 tracking-[0.14em]'>3D print support generator</p>
          <h1 className='text-[3.2rem] font-semibold leading-[1.08] mb-5 tracking-[-0.02em] max-w-[720px] mx-auto'>
            Negative-space supports that <span className='text-accent'>fit perfectly</span>
          </h1>
          <p className='text-[1.05rem] text-dim max-w-[520px] mx-auto mb-10 leading-relaxed'>
            Generate supports that wrap and curve around your model. Clean prints, spotless contact surfaces, stability during printing, and
            easy removal after. Works with STL, OBJ, and STEP files.
          </p>
          <div className='flex gap-3 justify-center'>
            <a
              href='/generate'
              className='inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium no-underline bg-accent text-base transition-all hover:brightness-110 glow-accent'>
              Generate now
              <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' className='opacity-60'>
                <path d='M5 12h14M12 5l7 7-7 7' />
              </svg>
            </a>
            <a
              href='/docs'
              className='inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-medium no-underline glass glass-hover text-primary/70'>
              Documentation
            </a>
          </div>
        </div>
      </section>

      {/* Install strip */}
      <section className='border-y border-border bg-base-alt'>
        <div className='max-w-[1100px] mx-auto px-6 grid grid-cols-3 max-md:grid-cols-1 divide-x max-md:divide-x-0 max-md:divide-y divide-border'>
          {/* Browser */}
          <div className='py-8 px-6 first:pl-0 last:pr-0 max-md:px-0 max-md:first:pt-8'>
            <p className='label-xs mb-3'>Browser</p>
            <p className='text-dim text-sm mb-3 leading-relaxed'>Upload and generate instantly. No install needed.</p>
            <div className='bg-base/60 border border-border rounded-md px-3 py-2 mb-3 overflow-x-auto'>
              <code className='font-mono text-xs text-code whitespace-pre'>STL, OBJ, STEP</code>
            </div>
            <a
              href='/generate'
              className='font-mono text-[11px] tracking-[0.06em] text-pink/60 no-underline hover:text-pink transition-colors'>
              Open generator &rarr;
            </a>
          </div>
          {/* npm */}
          <div className='py-8 px-6 max-md:px-0'>
            <p className='label-xs mb-3'>npm</p>
            <div className='bg-base/60 border border-border rounded-md px-3 py-2 mb-2 overflow-x-auto'>
              <code className='font-mono text-xs text-code whitespace-pre'>npx negative-support model.stl</code>
            </div>
            <div className='bg-base/60 border border-border rounded-md px-3 py-2 mb-3 overflow-x-auto'>
              <code className='font-mono text-xs text-code whitespace-pre'>npx negative-support model.step --3mf</code>
            </div>
            <a
              href='https://www.npmjs.com/package/negative-support'
              className='font-mono text-[11px] tracking-[0.06em] text-pink/60 no-underline hover:text-pink transition-colors'
              target='_blank'
              rel='noopener noreferrer'>
              View on npm &rarr;
            </a>
          </div>
          {/* pip */}
          <div className='py-8 px-6 last:pr-0 max-md:px-0 max-md:last:pb-8'>
            <p className='label-xs mb-3'>pip</p>
            <div className='bg-base/60 border border-border rounded-md px-3 py-2 mb-2 overflow-x-auto'>
              <code className='font-mono text-xs text-code whitespace-pre'>pip install negative-support</code>
            </div>
            <div className='bg-base/60 border border-border rounded-md px-3 py-2 mb-3 overflow-x-auto'>
              <code className='font-mono text-xs text-code whitespace-pre'>negative-support model.stl</code>
            </div>
            <a href='/docs' className='font-mono text-[11px] tracking-[0.06em] text-pink/60 no-underline hover:text-pink transition-colors'>
              Read the docs &rarr;
            </a>
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className='py-24'>
        <div className='max-w-[1100px] mx-auto px-6'>
          <p className='label-xs mb-4 text-center tracking-[0.14em]'>Why negative-space?</p>
          <h2 className='text-center mb-5 text-2xl font-semibold tracking-[-0.01em]'>Tree supports vs. negative-space</h2>
          <p className='text-dim text-center text-[1.05rem] max-w-[520px] mx-auto mb-10 leading-relaxed'>
            Custom supports that follow model curvature have been a secret weapon for those who could design them in CAD. Now, anyone can
            generate them with a single click — no CAD skills required.
          </p>
          <div className='flex justify-center mb-14'>
            <img src='/hero-outline.png' alt='Model with negative-space supports' className='h-[360px] w-auto opacity-70' />
          </div>
          <div className='grid grid-cols-2 gap-4 max-sm:grid-cols-1'>
            {/* Tree supports */}
            <div className='rounded-xl p-7 glass'>
              <div className='flex items-center gap-2.5 mb-5'>
                <div className='w-8 h-8 rounded-lg bg-pink-dim flex items-center justify-center'>
                  <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' className='text-pink'>
                    <line x1='18' y1='6' x2='6' y2='18' />
                    <line x1='6' y1='6' x2='18' y2='18' />
                  </svg>
                </div>
                <h3 className='text-[0.95rem] font-medium text-pink'>Tree supports</h3>
              </div>
              <ul className='list-none space-y-3'>
                {[
                  [
                    'Fuse to the model',
                    'Branch tips bond directly to surfaces, leaving scars, pitting, and layer damage that require sanding or reprinting.',
                  ],
                  [
                    'Ruin contact surfaces',
                    'Smooth faces, threads, and mating surfaces are marred wherever support tips touch — destroying the finish you designed for.',
                  ],
                  [
                    'Struggle with complex geometry',
                    'Non-planar overhangs, curved undercuts, and internal cavities receive inconsistent coverage, leading to failed prints or drooping layers.',
                  ],
                  [
                    'Difficult removal',
                    'Supports snap unevenly, leave stubs behind, and often take chunks of the model with them — especially with PETG and nylon.',
                  ],
                ].map(([title, desc]) => (
                  <li key={title} className='flex gap-3'>
                    <svg
                      width='14'
                      height='14'
                      viewBox='0 0 24 24'
                      fill='none'
                      stroke='currentColor'
                      strokeWidth='2.5'
                      className='text-pink/50 shrink-0 mt-0.5'>
                      <line x1='18' y1='6' x2='6' y2='18' />
                      <line x1='6' y1='6' x2='18' y2='18' />
                    </svg>
                    <div>
                      <p className='text-primary/70 text-sm font-medium'>{title}</p>
                      <p className='text-dim text-sm mt-0.5 leading-relaxed'>{desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            {/* Negative-space supports */}
            <div className='rounded-xl p-7 border border-accent/15 bg-accent-glow'>
              <div className='flex items-center gap-2.5 mb-5'>
                <div className='w-8 h-8 rounded-lg bg-accent-dim flex items-center justify-center'>
                  <svg
                    width='16'
                    height='16'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='2.5'
                    className='text-accent'>
                    <polyline points='20 6 9 17 4 12' />
                  </svg>
                </div>
                <h3 className='text-[0.95rem] font-medium text-accent'>Negative-space supports</h3>
              </div>
              <ul className='list-none space-y-3'>
                {[
                  [
                    'Reduced contact damage',
                    'A precision air gap (default 0.2mm) keeps supports from ever touching the model. Contact surfaces stay pristine.',
                  ],
                  [
                    'Improved surface finish',
                    'Supports curve around your geometry without fusing. Smooth faces, threads, and fine details print exactly as designed.',
                  ],
                  [
                    'Full coverage on any shape',
                    'The negative shell wraps non-planar overhangs, curved undercuts, and complex cavities uniformly — no gaps, no drooping.',
                  ],
                  [
                    'Clean snap-off removal',
                    'Supports lift away in one piece. No stubs, no prying, no damage. Works reliably across PLA, PETG, ABS, and nylon.',
                  ],
                ].map(([title, desc]) => (
                  <li key={title} className='flex gap-3'>
                    <svg
                      width='14'
                      height='14'
                      viewBox='0 0 24 24'
                      fill='none'
                      stroke='currentColor'
                      strokeWidth='2.5'
                      className='text-accent shrink-0 mt-0.5'>
                      <polyline points='20 6 9 17 4 12' />
                    </svg>
                    <div>
                      <p className='text-primary/70 text-sm font-medium'>{title}</p>
                      <p className='text-dim text-sm mt-0.5 leading-relaxed'>{desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className='py-24'>
        <div className='max-w-[1100px] mx-auto px-6'>
          <p className='label-xs mb-4 text-center tracking-[0.14em]'>Capabilities</p>
          <h2 className='text-center mb-6 text-2xl font-semibold tracking-[-0.01em]'>Built for precision printing</h2>
          <p className='text-dim text-center text-[1.05rem] max-w-[480px] mx-auto mb-14 leading-relaxed'>
            From overhang detection to slicer-ready export — everything you need in one tool.
          </p>
          <div className='grid grid-cols-2 gap-px max-sm:grid-cols-1 rounded-2xl overflow-hidden border border-border'>
            {[
              {
                icon: (
                  <svg
                    width='20'
                    height='20'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='1.5'
                    className='text-accent'>
                    <path d='M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z' />
                    <polyline points='3.27 6.96 12 12.01 20.73 6.96' />
                    <line x1='12' y1='22.08' x2='12' y2='12' />
                  </svg>
                ),
                label: 'STEP + Mesh',
                title: 'Smart overhang detection',
                desc: 'STEP files use B-Rep face topology to identify exactly which surfaces need support — only overhangs get them. STL and OBJ files receive full negative-shell supports around the entire model.',
              },
              {
                icon: (
                  <svg
                    width='20'
                    height='20'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='1.5'
                    className='text-accent'>
                    <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
                    <polyline points='14 2 14 8 20 8' />
                    <line x1='16' y1='13' x2='8' y2='13' />
                    <line x1='16' y1='17' x2='8' y2='17' />
                  </svg>
                ),
                label: '3MF export',
                title: 'Slicer-ready 3MF output',
                desc: 'The 3mf export bundles everything into a single file with per-object slicer settings for supports: 1 wall, 10% cubic infill. Open in your slicer and hit print.',
              },
              {
                icon: (
                  <svg
                    width='20'
                    height='20'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='1.5'
                    className='text-accent'>
                    <circle cx='12' cy='12' r='10' />
                    <path d='M12 8v4l3 3' />
                  </svg>
                ),
                label: 'Gap control',
                title: 'Precision air gap',
                desc: 'Supports follow every curve and contour of your model but leave a configurable gap (default 0.2mm). Tune it for your nozzle size and filament — tight enough to support, loose enough to snap off.',
              },
              {
                icon: (
                  <svg
                    width='20'
                    height='20'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='1.5'
                    className='text-accent'>
                    <rect x='2' y='3' width='20' height='14' rx='2' ry='2' />
                    <line x1='8' y1='21' x2='16' y2='21' />
                    <line x1='12' y1='17' x2='12' y2='21' />
                  </svg>
                ),
                label: 'Cross-platform',
                title: 'Web, npm, and pip',
                desc: 'Same algorithm everywhere. Generate in the browser, automate with the Node.js or Python CLI, or integrate via the JavaScript and Python APIs. Identical results on every platform.',
              },
            ].map((f) => (
              <div key={f.title} className='p-7 bg-surface-bright/50 group hover:bg-surface-bright transition-colors'>
                <div className='flex items-center gap-3 mb-3'>
                  <div className='w-9 h-9 rounded-lg bg-accent-dim/50 flex items-center justify-center shrink-0'>{f.icon}</div>
                  <div>
                    <p className='font-mono text-[9px] tracking-[0.14em] text-muted uppercase'>{f.label}</p>
                    <h3 className='text-[0.95rem] font-medium text-primary/80 group-hover:text-primary transition-colors leading-tight'>
                      {f.title}
                    </h3>
                  </div>
                </div>
                <p className='text-dim text-sm leading-relaxed'>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className='py-24 border-t border-border' id='pricing'>
        <div className='max-w-[1100px] mx-auto px-6'>
          <p className='label-xs mb-4 text-center tracking-[0.14em]'>Pricing</p>
          <h2 className='text-center mb-14 text-2xl font-semibold tracking-[-0.01em]'>Simple, one-time pricing</h2>
          <div className='grid grid-cols-2 gap-4 max-w-[580px] mx-auto max-sm:grid-cols-1'>
            {/* Free */}
            <div className='rounded-xl p-7 glass text-center'>
              <p className='label-xs mb-5'>Free tier</p>
              <div className='font-pixel text-[3rem] leading-none mb-1 text-primary/60'>$0</div>
              <p className='text-dim text-xs mb-6'>forever</p>
              <ul className='list-none mb-7 space-y-2.5'>
                <li className='text-dim text-sm flex items-center gap-2 justify-center'>
                  <svg
                    width='14'
                    height='14'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='2.5'
                    className='text-accent shrink-0'>
                    <polyline points='20 6 9 17 4 12' />
                  </svg>
                  10 free runs
                </li>
                <li className='text-dim text-sm flex items-center gap-2 justify-center'>
                  <svg
                    width='14'
                    height='14'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='2.5'
                    className='text-accent shrink-0'>
                    <polyline points='20 6 9 17 4 12' />
                  </svg>
                  All features included
                </li>
                <li className='text-dim text-sm flex items-center gap-2 justify-center'>
                  <svg
                    width='14'
                    height='14'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='2.5'
                    className='text-accent shrink-0'>
                    <polyline points='20 6 9 17 4 12' />
                  </svg>
                  GitHub login
                </li>
              </ul>
              <a
                href='/docs'
                className='inline-flex items-center px-5 py-2 rounded-lg text-sm font-medium no-underline glass glass-hover text-primary/70'>
                Get started
              </a>
            </div>
            {/* Lifetime */}
            <div className='rounded-xl p-7 text-center border border-accent/20 bg-[rgba(255,255,255,0.02)] relative overflow-hidden animate-glow-pulse'>
              <p className='label-xs mb-5 text-pink/50'>Lifetime</p>
              <div className='font-pixel text-[3rem] leading-none mb-1 text-pink'>$29</div>
              <p className='text-dim text-xs mb-6'>one-time payment</p>
              <ul className='list-none mb-7 space-y-2.5'>
                <li className='text-dim text-sm flex items-center gap-2 justify-center'>
                  <svg
                    width='14'
                    height='14'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='2.5'
                    className='text-accent shrink-0'>
                    <polyline points='20 6 9 17 4 12' />
                  </svg>
                  Unlimited runs
                </li>
                <li className='text-dim text-sm flex items-center gap-2 justify-center'>
                  <svg
                    width='14'
                    height='14'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='2.5'
                    className='text-accent shrink-0'>
                    <polyline points='20 6 9 17 4 12' />
                  </svg>
                  Up to 3 machines
                </li>
                <li className='text-dim text-sm flex items-center gap-2 justify-center'>
                  <svg
                    width='14'
                    height='14'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='2.5'
                    className='text-accent shrink-0'>
                    <polyline points='20 6 9 17 4 12' />
                  </svg>
                  All future updates
                </li>
              </ul>
              <button
                className='inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-accent text-base border-none cursor-pointer hover:brightness-110 transition-all disabled:opacity-60 disabled:cursor-not-allowed'
                onClick={handleBuy}
                disabled={loading}>
                {loading ? 'Redirecting...' : 'Buy now'}
                {!loading && (
                  <svg
                    width='14'
                    height='14'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='2.5'
                    className='opacity-60'>
                    <path d='M5 12h14M12 5l7 7-7 7' />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
