import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useCallback, useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/AuthContext'
import { loginUrl, logout } from '../lib/auth'

const FREE_RUNS = 10

export default function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, license, freeRemaining, loading } = useAuth()
  const [open, setOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const handlePricing = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setMenuOpen(false)
      if (location.pathname === '/') {
        document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })
      } else {
        navigate('/')
        setTimeout(() => {
          document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })
        }, 100)
      }
    },
    [navigate, location.pathname],
  )

  const handleLogout = useCallback(async () => {
    await logout()
    setOpen(false)
    setMenuOpen(false)
    window.location.href = '/'
  }, [])

  const handleCopyToken = useCallback(() => {
    if (license?.token) {
      navigator.clipboard.writeText(license.token)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [license?.token])

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  // Prevent body scroll when menu open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  const navLinks = (
    <>
      <Link
        to='/generate'
        onClick={() => setMenuOpen(false)}
        className='font-mono text-[11px] tracking-[0.08em] text-primary/35 no-underline transition-colors hover:text-primary/60 max-sm:text-sm max-sm:text-primary/50 max-sm:py-2'>
        Generate
      </Link>
      <Link
        to='/docs'
        onClick={() => setMenuOpen(false)}
        className='font-mono text-[11px] tracking-[0.08em] text-primary/35 no-underline transition-colors hover:text-primary/60 max-sm:text-sm max-sm:text-primary/50 max-sm:py-2'>
        Docs
      </Link>
      <a
        href='/#pricing'
        onClick={handlePricing}
        className='font-mono text-[11px] tracking-[0.08em] text-primary/35 no-underline transition-colors hover:text-primary/60 cursor-pointer max-sm:text-sm max-sm:text-primary/50 max-sm:py-2'>
        Pricing
      </a>
      <a
        href='https://github.com/drcmda/negative-support'
        target='_blank'
        rel='noopener noreferrer'
        className='text-primary/35 no-underline transition-colors hover:text-primary/60 flex items-center max-sm:py-2'
        aria-label='GitHub'>
        <svg width='16' height='16' viewBox='0 0 24 24' fill='currentColor'>
          <path d='M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z' />
        </svg>
      </a>
    </>
  )

  return (
    <>
    <header className='fixed top-0 left-0 right-0 z-50 border-b border-border/50 py-3.5 bg-base/80 backdrop-blur-md'>
      <div className='max-w-[1200px] mx-auto px-6 flex items-center justify-between'>
        <Link
          to='/'
          className='font-mono text-[13px] font-medium text-primary/70 no-underline tracking-wide hover:text-primary transition-colors'>
          negative-support
        </Link>

        {/* Desktop nav */}
        <nav className='flex items-center gap-5 max-sm:hidden'>
          {navLinks}

          {!loading &&
            (user ? (
              <div className='relative' ref={dropdownRef}>
                <button
                  onClick={() => setOpen(!open)}
                  className='w-7 h-7 rounded-full overflow-hidden border border-border hover:border-primary/30 transition-colors cursor-pointer bg-surface p-0'>
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.login} className='w-full h-full object-cover' />
                  ) : (
                    <span className='flex items-center justify-center w-full h-full text-xs text-dim font-mono'>
                      {user.login[0].toUpperCase()}
                    </span>
                  )}
                </button>

                {open && (
                  <div className='absolute right-0 top-[calc(100%+8px)] w-[280px] rounded-xl bg-base-alt border border-border p-4 z-50 shadow-lg shadow-black/40'>
                    {/* User info */}
                    <div className='mb-3 pb-3 border-b border-border'>
                      <p className='text-primary text-sm font-medium'>{user.login}</p>
                      {user.email && <p className='text-muted text-xs font-mono mt-0.5'>{user.email}</p>}
                    </div>

                    {/* Token */}
                    {license && (
                      <div className='mb-3 pb-3 border-b border-border'>
                        <p className='text-muted text-[10px] font-mono tracking-wider mb-1.5'>TOKEN</p>
                        <button
                          onClick={handleCopyToken}
                          className='w-full text-left px-2.5 py-1.5 rounded-md bg-base/60 border border-border text-xs font-mono text-dim hover:text-primary hover:border-primary/20 transition-colors cursor-pointer truncate'
                          title='Click to copy'>
                          {copied ? 'Copied!' : license.token}
                        </button>
                      </div>
                    )}

                    {/* License status */}
                    <div className='mb-3 pb-3 border-b border-border'>
                      {license?.plan === 'lifetime' ? (
                        <span className='inline-flex items-center gap-1.5 text-accent text-xs font-mono'>
                          <svg width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='3'>
                            <polyline points='20 6 9 17 4 12' />
                          </svg>
                          Lifetime license
                        </span>
                      ) : (
                        <div className='flex items-center justify-between'>
                          <span className='text-dim text-xs font-mono'>
                            Free · {freeRemaining}/{FREE_RUNS} remaining
                          </span>
                          <a
                            href='/#pricing'
                            onClick={(e) => {
                              setOpen(false)
                              handlePricing(e)
                            }}
                            className='text-pink/70 text-xs no-underline hover:text-pink transition-colors'>
                            Upgrade
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Sign out */}
                    <button
                      onClick={handleLogout}
                      className='w-full text-left text-dim text-xs hover:text-primary transition-colors cursor-pointer bg-transparent border-none p-0'>
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <a
                href={loginUrl()}
                className='font-mono text-[11px] tracking-[0.08em] text-primary/50 no-underline transition-colors hover:text-primary/80 px-2.5 py-1 rounded-full border border-border hover:border-primary/20'>
                Sign in
              </a>
            ))}
        </nav>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className='hidden max-sm:flex items-center justify-center w-8 h-8 bg-transparent border-none cursor-pointer p-0 relative'
          aria-label='Menu'>
          <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'
            className='text-primary/50 absolute transition-all duration-200'
            style={{ opacity: menuOpen ? 0 : 1, transform: menuOpen ? 'rotate(45deg) scale(0.8)' : 'rotate(0) scale(1)' }}>
            <line x1='3' y1='6' x2='21' y2='6' />
            <line x1='3' y1='12' x2='21' y2='12' />
            <line x1='3' y1='18' x2='21' y2='18' />
          </svg>
          <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'
            className='text-primary/50 absolute transition-all duration-200'
            style={{ opacity: menuOpen ? 1 : 0, transform: menuOpen ? 'rotate(0) scale(1)' : 'rotate(-45deg) scale(0.8)' }}>
            <line x1='6' y1='6' x2='18' y2='18' />
            <line x1='18' y1='6' x2='6' y2='18' />
          </svg>
        </button>
      </div>

    </header>

    {/* Mobile menu overlay — outside header to avoid stacking context issues */}
    <div
      className='sm:hidden fixed left-0 right-0 bottom-0 z-50 transition-transform duration-300 ease-out'
      style={{
        background: '#050505',
        top: 53,
        transform: menuOpen ? 'translateX(0)' : 'translateX(-100%)',
      }}>
        <nav className='flex flex-col gap-1 p-6'>
          {navLinks}
          <div className='mt-4 pt-4 border-t border-border/50'>
            {!loading &&
              (user ? (
                <div className='flex flex-col gap-3'>
                  <div className='flex items-center gap-3'>
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.login} className='w-7 h-7 rounded-full border border-border' />
                    ) : (
                      <span className='flex items-center justify-center w-7 h-7 rounded-full border border-border text-xs text-dim font-mono bg-surface'>
                        {user.login[0].toUpperCase()}
                      </span>
                    )}
                    <span className='text-primary text-sm font-medium'>{user.login}</span>
                  </div>
                  {license && (
                    <button
                      onClick={handleCopyToken}
                      className='w-full text-left px-2.5 py-1.5 rounded-md bg-base/60 border border-border text-xs font-mono text-dim hover:text-primary hover:border-primary/20 transition-colors cursor-pointer truncate'
                      title='Click to copy'>
                      {copied ? 'Copied!' : license.token}
                    </button>
                  )}
                  {license?.plan === 'lifetime' ? (
                    <span className='inline-flex items-center gap-1.5 text-accent text-xs font-mono'>
                      <svg width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='3'>
                        <polyline points='20 6 9 17 4 12' />
                      </svg>
                      Lifetime license
                    </span>
                  ) : (
                    <div className='flex items-center justify-between'>
                      <span className='text-dim text-xs font-mono'>
                        Free · {freeRemaining}/{FREE_RUNS} remaining
                      </span>
                      <a
                        href='/#pricing'
                        onClick={handlePricing}
                        className='text-pink/70 text-sm no-underline hover:text-pink transition-colors'>
                        Upgrade
                      </a>
                    </div>
                  )}
                  <button
                    onClick={handleLogout}
                    className='text-left text-dim text-sm hover:text-primary transition-colors cursor-pointer bg-transparent border-none p-0 py-2'>
                    Sign out
                  </button>
                </div>
              ) : (
                <a
                  href={loginUrl()}
                  className='font-mono text-sm text-primary/50 no-underline transition-colors hover:text-primary/80'>
                  Sign in
                </a>
              ))}
          </div>
        </nav>
    </div>
    </>
  )
}
