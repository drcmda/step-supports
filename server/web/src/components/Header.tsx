import { Link, useNavigate, useLocation } from "react-router-dom";
import { useCallback } from "react";

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();

  const handlePricing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (location.pathname === "/") {
      document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate("/");
      // Wait for navigation, then scroll
      setTimeout(() => {
        document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [navigate, location.pathname]);

  return (
    <header className="border-b border-border py-3.5">
      <div className="max-w-[1100px] mx-auto px-6 flex items-center justify-between">
        <Link to="/" className="font-mono text-[13px] font-medium text-primary/70 no-underline tracking-wide hover:text-primary transition-colors">
          negative-support
        </Link>
        <nav className="flex gap-5">
          <Link to="/generate" className="font-mono text-[11px] tracking-[0.08em] text-primary/35 no-underline transition-colors hover:text-primary/60">Generate</Link>
          <Link to="/docs" className="font-mono text-[11px] tracking-[0.08em] text-primary/35 no-underline transition-colors hover:text-primary/60">Docs</Link>
          <a href="/#pricing" onClick={handlePricing} className="font-mono text-[11px] tracking-[0.08em] text-primary/35 no-underline transition-colors hover:text-primary/60 cursor-pointer">Pricing</a>
        </nav>
      </div>
    </header>
  );
}
