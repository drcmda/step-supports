import { Link, useNavigate, useLocation } from "react-router-dom";
import { useCallback, useState, useEffect, useRef } from "react";
import { useAuth } from "../lib/AuthContext";
import { loginUrl, logout } from "../lib/auth";

const FREE_RUNS = 10;

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, license, freeRemaining, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handlePricing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (location.pathname === "/") {
      document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate("/");
      setTimeout(() => {
        document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [navigate, location.pathname]);

  const handleLogout = useCallback(async () => {
    await logout();
    setOpen(false);
    window.location.href = "/";
  }, []);

  const handleCopyToken = useCallback(() => {
    if (license?.token) {
      navigator.clipboard.writeText(license.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [license?.token]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <header className="border-b border-border py-3.5">
      <div className="max-w-[1100px] mx-auto px-6 flex items-center justify-between">
        <Link to="/" className="font-mono text-[13px] font-medium text-primary/70 no-underline tracking-wide hover:text-primary transition-colors">
          negative-support
        </Link>
        <nav className="flex items-center gap-5">
          <Link to="/generate" className="font-mono text-[11px] tracking-[0.08em] text-primary/35 no-underline transition-colors hover:text-primary/60">Generate</Link>
          <Link to="/docs" className="font-mono text-[11px] tracking-[0.08em] text-primary/35 no-underline transition-colors hover:text-primary/60">Docs</Link>
          <a href="/#pricing" onClick={handlePricing} className="font-mono text-[11px] tracking-[0.08em] text-primary/35 no-underline transition-colors hover:text-primary/60 cursor-pointer">Pricing</a>

          {!loading && (
            user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setOpen(!open)}
                  className="w-7 h-7 rounded-full overflow-hidden border border-border hover:border-primary/30 transition-colors cursor-pointer bg-surface p-0"
                >
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.login} className="w-full h-full object-cover" />
                  ) : (
                    <span className="flex items-center justify-center w-full h-full text-xs text-dim font-mono">
                      {user.login[0].toUpperCase()}
                    </span>
                  )}
                </button>

                {open && (
                  <div className="absolute right-0 top-[calc(100%+8px)] w-[280px] rounded-xl glass border border-border p-4 z-50">
                    {/* User info */}
                    <div className="mb-3 pb-3 border-b border-border">
                      <p className="text-primary text-sm font-medium">{user.login}</p>
                      {user.email && <p className="text-muted text-xs font-mono mt-0.5">{user.email}</p>}
                    </div>

                    {/* Token */}
                    {license && (
                      <div className="mb-3 pb-3 border-b border-border">
                        <p className="text-muted text-[10px] font-mono tracking-wider mb-1.5">TOKEN</p>
                        <button
                          onClick={handleCopyToken}
                          className="w-full text-left px-2.5 py-1.5 rounded-md bg-base/60 border border-border text-xs font-mono text-dim hover:text-primary hover:border-primary/20 transition-colors cursor-pointer truncate"
                          title="Click to copy"
                        >
                          {copied ? "Copied!" : license.token}
                        </button>
                      </div>
                    )}

                    {/* License status */}
                    <div className="mb-3 pb-3 border-b border-border">
                      {license?.plan === "lifetime" ? (
                        <span className="inline-flex items-center gap-1.5 text-accent text-xs font-mono">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                          Lifetime license
                        </span>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="text-dim text-xs font-mono">Free · {freeRemaining}/{FREE_RUNS} remaining</span>
                          <a href="/#pricing" onClick={(e) => { setOpen(false); handlePricing(e); }} className="text-pink/70 text-xs no-underline hover:text-pink transition-colors">
                            Upgrade
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Sign out */}
                    <button
                      onClick={handleLogout}
                      className="w-full text-left text-dim text-xs hover:text-primary transition-colors cursor-pointer bg-transparent border-none p-0"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <a
                href={loginUrl()}
                className="font-mono text-[11px] tracking-[0.08em] text-primary/50 no-underline transition-colors hover:text-primary/80 px-2.5 py-1 rounded-full border border-border hover:border-primary/20"
              >
                Sign in
              </a>
            )
          )}
        </nav>
      </div>
    </header>
  );
}
