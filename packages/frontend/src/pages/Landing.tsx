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
            that <span className='text-accent inline-block origin-left'>fit perfectly</span>
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

      {/* Explainer + Comparison */}
      <section className='py-24'>
        <div className='max-w-[1200px] mx-auto px-6'>
          <p className='label-xs mb-4 text-center tracking-[0.14em]'>What is this?</p>
          <h2 className='text-center mb-6 text-2xl font-semibold tracking-[-0.01em]'>Supports that are shaped like your model</h2>
          <p className='text-dim text-center text-[1.05rem] max-w-[580px] mx-auto mb-14 leading-relaxed'>
            Drop in a STEP, STL or OBJ file, get back supports shaped like the negative space around your model. Negative-space supports
            have been around for a while, but you needed to{' '}
            <a
              href='https://www.youtube.com/watch?v=_R2E8VwyNz0'
              target='_blank'
              rel='noopener noreferrer'
              className='text-accent/70 underline underline-offset-2 hover:text-accent transition-colors'>
              design them in CAD
            </a>{' '}
            by hand. This tool does it automatically.
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
          <div className='grid grid-cols-[3fr_2.5fr] gap-5 max-sm:grid-cols-1'>
            {/* Tree supports — top left */}
            <div className='rounded-xl p-7'>
              <div className='flex items-center gap-2.5 mb-5'>
                <div className='w-8 h-8 rounded-lg bg-pink-dim flex items-center justify-center'>
                  <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' className='text-pink'>
                    <line x1='18' y1='6' x2='6' y2='18' />
                    <line x1='6' y1='6' x2='18' y2='18' />
                  </svg>
                </div>
                <h3 className='text-[0.95rem] font-medium text-pink'>Tree and column supports</h3>
              </div>
              <ul className='list-none space-y-3'>
                {[
                  ['Fuse to the model', 'Tips bond to surfaces, scarring threads, mating faces, and smooth finishes.'],
                  ['Struggle with complex geometry', 'Curved overhangs and internal cavities get inconsistent coverage.'],
                  ['Are difficult to remove', 'Supports snap unevenly and leave stubs — especially with PETG and nylon.'],
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
            {/* Negative-space supports — top right */}
            <div className='rounded-xl p-7'>
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
                  ['Have less contact damage', 'A configurable air gap keeps supports off the surface. Fine details come out clean.'],
                  ['Cover on any shape', 'Supports follow overhangs, undercuts, and cavities uniformly.'],
                  ['Are easier to remove', 'Supports lift off in one piece. Works across PLA, PETG, ABS, and nylon.'],
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
            {/* Bottom left — 2 items side by side */}
            <div className='grid grid-cols-2 gap-5 max-lg:grid-cols-1'>
              {[
                [
                  "Who it's for",
                  'Designers and creators',
                  'Ship your models with pre-made supports for the cleanest results. STEP gives the best results — the algorithm reads B-Rep faces directly.',
                ],
                [
                  'Also for',
                  'People who print',
                  'STL are not as precise as STEP, but supports could beat your slicer. More stability while printing, cleaner results and easier removal.',
                ],
              ].map(([label, title, desc]) => (
                <div key={label} className='flex gap-2.5 rounded-xl p-7'>
                  <div className='w-8 shrink-0' />
                  <div>
                    <p className='label-xs mb-3 text-accent/70'>{label}</p>
                    <p className='text-sm text-primary/70 font-medium mb-2'>{title}</p>
                    <p className='text-dim text-sm leading-relaxed'>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            {/* Bottom right */}
            <div className='flex gap-2.5 rounded-xl p-7'>
              <div className='w-8 shrink-0' />
              <div>
                <p className='label-xs mb-3 text-accent/70'>How it works</p>
                <p className='text-sm text-primary/70 font-medium mb-2'>Boolean subtraction</p>
                <p className='text-dim text-sm leading-relaxed'>
                  Your model is subtracted from a bounding column — what's left is the support. A configurable air gap helps to keep
                  supports from fusing to the surface. STEP files use B-Rep face normals for overhang detection; STL and OBJ files use
                  triangle-normal clustering. Output is a slicer-ready 3MF.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className='py-24 border-t border-border bg-base-alt'>
        <div className='max-w-[1200px] mx-auto px-6 pb-6'>
          <p className='label-xs mb-4 text-center tracking-[0.14em]'>Capabilities</p>
          <h2 className='text-center mb-6 text-2xl font-semibold tracking-[-0.01em]'>What's in the box</h2>
          <p className='text-dim text-center text-[1.05rem] max-w-[480px] mx-auto leading-relaxed'>
            Overhang detection, gap control, slicer-ready export.
          </p>
        </div>
        <div className='max-w-[1200px] mx-auto px-6 grid grid-cols-4 max-md:grid-cols-2 max-sm:grid-cols-1'>
          {[
            {
              icon: (
                <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.5' className='text-accent'>
                  <path d='M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z' />
                  <polyline points='3.27 6.96 12 12.01 20.73 6.96' />
                  <line x1='12' y1='22.08' x2='12' y2='12' />
                </svg>
              ),
              label: 'STEP + Mesh',
              title: 'Smart overhang detection',
              desc: 'STEP files get B-Rep face detection. STL and OBJ use triangle-normal clustering. Both produce per-region supports.',
            },
            {
              icon: (
                <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.5' className='text-accent'>
                  <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
                  <polyline points='14 2 14 8 20 8' />
                  <line x1='16' y1='13' x2='8' y2='13' />
                  <line x1='16' y1='17' x2='8' y2='17' />
                </svg>
              ),
              label: '3MF export',
              title: 'Slicer-ready 3MF output',
              desc: 'Bundles model + supports into one file with slicer settings baked in (1 wall, 10% cubic infill). Open and print.',
            },
            {
              icon: (
                <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.5' className='text-accent'>
                  <circle cx='12' cy='12' r='10' />
                  <path d='M12 8v4l3 3' />
                </svg>
              ),
              label: 'Gap control',
              title: 'Precision air gap',
              desc: 'Configurable margin between model and support (default 0.2 mm). Tune it for your nozzle and filament.',
            },
            {
              icon: (
                <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.5' className='text-accent'>
                  <rect x='2' y='3' width='20' height='14' rx='2' ry='2' />
                  <line x1='8' y1='21' x2='16' y2='21' />
                  <line x1='12' y1='17' x2='12' y2='21' />
                </svg>
              ),
              label: 'Cross-platform',
              title: 'Web, CLI, and API',
              desc: 'Same algorithm in the browser, CLI, and JS API. Identical output everywhere.',
            },
          ].map((f, i) => (
            <div key={f.title} className='py-8 px-6 max-md:px-0 max-md:py-6'>
              <div className='w-9 h-9 rounded-lg bg-accent-dim/50 flex items-center justify-center shrink-0 mb-3'>{f.icon}</div>
              <p className='label-xs mb-2'>{f.label}</p>
              <p className='text-primary/70 text-sm font-medium mb-1'>{f.title}</p>
              <p className='text-dim text-sm leading-relaxed'>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className='py-32 border-t border-border' id='pricing'>
        <div className='max-w-[1200px] mx-auto px-6'>
          <p className='label-xs mb-4 text-center tracking-[0.14em]'>Pricing</p>
          <h2 className='text-center mb-4 text-2xl font-semibold tracking-[-0.01em]'>Simple, one-time pricing</h2>
          <p className='text-dim text-center text-[1.05rem] max-w-[420px] mx-auto mb-14 leading-relaxed'>
            Start free. Consider helping us keep improving by purchasing a lifetime license. Your support means a lot and helps fund
            development, filament for testing, maintenance, and new features.
          </p>

          <div className='max-w-[760px] mx-auto rounded-xl border border-accent/10 overflow-hidden'>
            {/* Header bar */}
            <div className='flex items-center justify-between px-5 py-3 border-b border-accent/10 bg-accent/[0.03]'>
              <div className='flex items-center gap-2.5'>
                <div className='w-1.5 h-1.5 rounded-full bg-accent animate-pulse' />
                <span className='font-mono text-[10px] tracking-[0.16em] text-accent/60 uppercase'>License plans</span>
              </div>
              <span className='font-mono text-[10px] text-muted'>USD · Stripe</span>
            </div>

            {/* Two plans side by side */}
            <div className='grid grid-cols-2 max-sm:grid-cols-1'>
              {/* Free */}
              <div className='px-7 py-8 border-r border-accent/10 max-sm:border-r-0 max-sm:border-b'>
                <p className='font-mono text-[10px] tracking-[0.12em] text-muted mb-4 uppercase'>Free tier</p>
                <div className='flex items-baseline gap-1 mb-6'>
                  <span className='font-[family-name:var(--font-pixel-grid)] text-5xl text-primary/50 leading-none'>$0</span>
                </div>
                <div className='space-y-2.5 mb-8'>
                  {['10 free runs', 'All features included', 'GitHub login'].map((item) => (
                    <div key={item} className='flex items-center gap-2.5'>
                      <svg
                        width='12'
                        height='12'
                        viewBox='0 0 24 24'
                        fill='none'
                        stroke='currentColor'
                        strokeWidth='2.5'
                        className='text-accent/50 shrink-0'>
                        <polyline points='20 6 9 17 4 12' />
                      </svg>
                      <span className='font-[family-name:var(--font-pixel-square)] text-xs text-primary/50'>{item}</span>
                    </div>
                  ))}
                </div>
                <a
                  href='/docs'
                  className='inline-flex items-center px-4 py-2 rounded-lg text-xs font-mono no-underline text-primary/50 border border-border hover:border-accent/20 transition-colors'>
                  Get started
                </a>
              </div>

              {/* Lifetime */}
              <div className='px-7 py-8'>
                <div className='flex items-center gap-2.5 mb-4'>
                  <p className='font-mono text-[10px] tracking-[0.12em] text-accent/60 uppercase'>Lifetime</p>
                  <span className='font-mono text-[9px] tracking-wider text-muted/40 uppercase'>recommended</span>
                </div>
                <div className='flex items-baseline gap-1.5 mb-1'>
                  <span className='font-[family-name:var(--font-pixel-grid)] text-5xl text-accent leading-none'>${price}</span>
                </div>
                <p className='font-mono text-[10px] text-muted/60 mb-6'>one-time payment</p>
                <div className='space-y-2.5 mb-8'>
                  {['Unlimited runs', 'Up to 3 machines', 'All future updates'].map((item) => (
                    <div key={item} className='flex items-center gap-2.5'>
                      <svg
                        width='12'
                        height='12'
                        viewBox='0 0 24 24'
                        fill='none'
                        stroke='currentColor'
                        strokeWidth='2.5'
                        className='text-accent shrink-0'>
                        <polyline points='20 6 9 17 4 12' />
                      </svg>
                      <span className='font-[family-name:var(--font-pixel-square)] text-xs text-primary/70'>{item}</span>
                    </div>
                  ))}
                </div>
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
          </div>
        </div>
      </section>
    </div>
  )
}
