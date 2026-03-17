import { useState, useEffect } from 'react'
import { useAuth } from '../lib/AuthContext'

export default function Landing() {
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(false)
  const [price, setPrice] = useState(19)

  useEffect(() => {
    fetch('/api/price')
      .then((r) => r.json())
      .then((d) => {
        if (d.amount) setPrice(d.amount)
      })
      .catch(() => {})
  }, [])

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
      <section className='relative min-h-screen overflow-hidden flex items-end'>
        {/* Background video */}
        <video className='absolute inset-0 w-full h-full object-cover' autoPlay muted loop playsInline src='/hero-video.mp4' />
        {/* Dark overlay */}
        <div className='absolute inset-0 bg-black/50' />
        {/* Subtle accent glow */}
        <div
          className='absolute inset-0 pointer-events-none'
          style={{ background: 'radial-gradient(ellipse 800px 400px at 0% 100%, rgba(93,228,199,0.06) 0%, transparent 70%)' }}
        />
        {/* Text backdrop */}
        <div
          className='absolute inset-0 pointer-events-none'
          style={{
            background:
              'linear-gradient(to top, color-mix(in srgb, var(--color-base) 85%, transparent) 0%, color-mix(in srgb, var(--color-base) 85%, transparent) 30%, transparent 65%)',
          }}
        />
        {/* Content */}
        <div className='relative max-w-[1200px] mx-auto px-6 pb-36 pt-32 w-full'>
          <p className='label-xs mb-5 tracking-[0.14em]'>3D print support generator</p>
          <h1 className='text-[3.8rem] font-semibold leading-[1.06] mb-6 tracking-[-0.02em]'>
            <span className='max-md:whitespace-normal whitespace-nowrap'>Negative-space supports</span>
            <br />
            that <span className='text-accent'>fit perfectly</span>
          </h1>
          <p className='text-[1.1rem] text-dim max-w-[460px] mb-10 leading-relaxed'>
            Generate volumetric supports that follow the curvature of your model. Clean prints, spotless contact surfaces, stability during
            printing, and easy removal after.
          </p>
          <div className='flex gap-3'>
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
        <div className='max-w-[1200px] mx-auto px-6 grid grid-cols-3 max-md:grid-cols-1 divide-x max-md:divide-x-0 max-md:divide-y divide-border'>
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
          {/* api */}
          <div className='py-8 px-6 last:pr-0 max-md:px-0 max-md:last:pb-8'>
            <p className='label-xs mb-3'>api</p>
            <div className='bg-base/60 border border-border rounded-md px-3 py-2 mb-2 overflow-x-auto'>
              <code className='font-mono text-xs text-code whitespace-pre'>npm install negative-support</code>
            </div>
            <div className='bg-base/60 border border-border rounded-md px-3 py-2 mb-3 overflow-x-auto'>
              <code className='font-mono text-xs text-code whitespace-pre'>{`import { generateSupports } from 'negative-support'`}</code>
            </div>
            <a href='/docs' className='font-mono text-[11px] tracking-[0.06em] text-pink/60 no-underline hover:text-pink transition-colors'>
              Read the docs &rarr;
            </a>
          </div>
        </div>
      </section>

      {/* Explainer */}
      <section className='py-24'>
        <div className='max-w-[1200px] mx-auto px-6'>
          <p className='label-xs mb-4 text-center tracking-[0.14em]'>What is this?</p>
          <h2 className='text-center mb-6 text-2xl font-semibold tracking-[-0.01em]'>Supports that are shaped like your model</h2>
          <p className='text-dim text-center text-[1.05rem] max-w-[580px] mx-auto mb-14 leading-relaxed'>
            Feed it a 3D model, get back support structures that conform to every surface. Instead of generic trees or grids, it subtracts
            your model from a solid block — the leftover is the support. A precision air gap keeps them from touching, so they snap off
            clean.
          </p>
          <div className='grid grid-cols-3 gap-5 max-sm:grid-cols-1'>
            {/* Who */}
            <div className='rounded-xl p-7 glass'>
              <p className='label-xs mb-3 text-accent/70'>Who it's for</p>
              <p className='text-sm text-primary/70 font-medium mb-2'>Designers and creators</p>
              <p className='text-dim text-sm leading-relaxed'>
                If you design and publish 3D models, ship them with pre-made supports for perfect results out of the box. Your users get a
                single file that prints without tuning. STEP files give the best results — full B-Rep overhang detection per face.
              </p>
            </div>
            {/* Who 2 */}
            <div className='rounded-xl p-7 glass'>
              <p className='label-xs mb-3 text-accent/70'>Also for</p>
              <p className='text-sm text-primary/70 font-medium mb-2'>People who print</p>
              <p className='text-dim text-sm leading-relaxed'>
                Downloaded an STL that needs supports? Drop it in and generate. Triangle-normal clustering gives you targeted per-region
                supports — not as precise as STEP, but in some cases better than what your slicer generates.
              </p>
            </div>
            {/* How */}
            <div className='rounded-xl p-7 glass'>
              <p className='label-xs mb-3 text-accent/70'>How it works</p>
              <p className='text-sm text-primary/70 font-medium mb-2'>Boolean subtraction</p>
              <p className='text-dim text-sm leading-relaxed'>
                The model is inflated outward by a small margin, then subtracted from a bounding column using boolean operations. The
                negative space left behind is your support. Overlapping pieces are merged, tiny fragments discarded.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className='py-24'>
        <div className='max-w-[1200px] mx-auto px-6'>
          <p className='label-xs mb-4 text-center tracking-[0.14em]'>Why negative-space?</p>
          <h2 className='text-center mb-5 text-2xl font-semibold tracking-[-0.01em]'>Tree supports vs. negative-space</h2>
          <p className='text-dim text-center text-[1.05rem] max-w-[520px] mx-auto mb-10 leading-relaxed'>
            Custom volumetric supports that follow model curvature have been a secret weapon for those who could{' '}
            <a
              href='https://www.youtube.com/watch?v=_R2E8VwyNz0'
              target='_blank'
              rel='noopener noreferrer'
              className='text-accent/70 underline underline-offset-2 hover:text-accent transition-colors'>
              design them in CAD
            </a>
            . Now, anyone can generate them with a single click — no CAD skills required.
          </p>
          <div className='flex justify-center items-end gap-8 mb-14 max-sm:gap-4'>
            <div className='text-center'>
              <img src='/outline-model.png' alt='Model outline' className='h-[320px] w-auto opacity-70 max-sm:h-[140px]' />
              <p className='label-xs mt-3'>Model</p>
            </div>
            <div className='text-center'>
              <img src='/outline-supports.png' alt='Support outline' className='h-[234px] w-auto opacity-70 max-sm:h-[102px]' />
              <p className='label-xs mt-3'>Supports</p>
            </div>
            <div className='text-center'>
              <img src='/outline-combined.png' alt='Model with supports' className='h-[320px] w-auto opacity-70 max-sm:h-[140px]' />
              <p className='label-xs mt-3'>Combined</p>
            </div>
          </div>
          <div className='grid grid-cols-2 gap-5 max-sm:grid-cols-1'>
            {/* Tree supports */}
            <div className='rounded-xl p-7 glass'>
              <div className='flex items-center gap-2.5 mb-5'>
                <div className='w-8 h-8 rounded-lg bg-pink-dim flex items-center justify-center'>
                  <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' className='text-pink'>
                    <line x1='18' y1='6' x2='6' y2='18' />
                    <line x1='6' y1='6' x2='18' y2='18' />
                  </svg>
                </div>
                <h3 className='text-[0.95rem] font-medium text-pink'>Tree-, Block-Supports</h3>
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
                  <li key={title} className='flex gap-2.5'>
                    <div className='w-8 shrink-0 flex justify-center pt-0.5'>
                      <svg
                        width='14'
                        height='14'
                        viewBox='0 0 24 24'
                        fill='none'
                        stroke='currentColor'
                        strokeWidth='2.5'
                        className='text-pink/50'>
                        <line x1='18' y1='6' x2='6' y2='18' />
                        <line x1='6' y1='6' x2='18' y2='18' />
                      </svg>
                    </div>
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
                  <li key={title} className='flex gap-2.5'>
                    <div className='w-8 shrink-0 flex justify-center pt-0.5'>
                      <svg
                        width='14'
                        height='14'
                        viewBox='0 0 24 24'
                        fill='none'
                        stroke='currentColor'
                        strokeWidth='2.5'
                        className='text-accent'>
                        <polyline points='20 6 9 17 4 12' />
                      </svg>
                    </div>
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
        <div className='max-w-[1200px] mx-auto px-6'>
          <p className='label-xs mb-4 text-center tracking-[0.14em]'>Capabilities</p>
          <h2 className='text-center mb-6 text-2xl font-semibold tracking-[-0.01em]'>Built for precision printing</h2>
          <p className='text-dim text-center text-[1.05rem] max-w-[480px] mx-auto mb-14 leading-relaxed'>
            From overhang detection to slicer-ready export — everything you need in one tool.
          </p>
          <div className='grid grid-cols-2 gap-5 max-sm:grid-cols-1'>
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
                desc: 'STEP files use B-Rep face topology to identify exactly which surfaces need support. STL and OBJ files use triangle-normal clustering to detect overhang regions — both produce targeted per-region supports.',
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
                title: 'Web, CLI, and API',
                desc: 'Same algorithm everywhere. Generate in the browser, automate with the CLI, or integrate via the JavaScript API. Identical results on every platform.',
              },
            ].map((f) => (
              <div key={f.title} className='rounded-xl p-7 glass group hover:bg-surface-bright/60 transition-colors'>
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
      <section className='relative py-32 border-t border-border overflow-hidden' id='pricing'>
        {/* Background glow */}
        <div
          className='absolute inset-0 pointer-events-none'
          style={{ background: 'radial-gradient(ellipse 600px 500px at 50% 50%, rgba(93,228,199,0.05) 0%, transparent 70%)' }}
        />
        <div
          className='absolute inset-0 pointer-events-none'
          style={{ background: 'radial-gradient(ellipse 400px 300px at 60% 55%, rgba(240,135,189,0.04) 0%, transparent 70%)' }}
        />
        <div className='relative max-w-[1200px] mx-auto px-6'>
          <p className='label-xs mb-4 text-center tracking-[0.14em]'>Pricing</p>
          <h2 className='text-center mb-4 text-3xl font-semibold tracking-[-0.02em]'>Simple, one-time pricing</h2>
          <p className='text-dim text-center text-[1.05rem] max-w-[420px] mx-auto mb-14 leading-relaxed'>
            Start free. Upgrade when you're ready — one payment, no subscriptions.
          </p>
          <div className='grid grid-cols-2 gap-5 max-w-[760px] mx-auto max-sm:grid-cols-1'>
            {/* Free */}
            <div className='rounded-2xl p-9 glass text-center'>
              <p className='label-xs mb-6'>Free tier</p>
              <div className='text-[3rem] leading-none mb-2 text-primary/60'>$0</div>
              <p className='text-dim text-xs mb-8'>&nbsp;</p>
              <ul className='list-none mb-8 space-y-3'>
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
            <div className='rounded-2xl p-9 text-center border border-accent/20 bg-[rgba(255,255,255,0.02)] relative overflow-hidden animate-glow-pulse'>
              <p className='label-xs mb-6 text-pink/50'>Lifetime</p>
              <div className='text-[3rem] leading-none mb-2 text-pink'>${price}</div>
              <p className='text-dim text-xs mb-8'>one-time payment</p>
              <ul className='list-none mb-8 space-y-3'>
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
              {user ? (
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
              ) : (
                <a
                  href='/api/auth/github'
                  className='inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-accent text-base no-underline hover:brightness-110 transition-all'>
                  Sign in to buy
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
                </a>
              )}
            </div>
          </div>
          <p className='text-center mt-10 text-muted text-xs font-mono'>All prices in USD · Secure checkout via Stripe</p>
        </div>
      </section>
    </div>
  )
}
