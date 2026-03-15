import { Link } from "react-router-dom";

export default function Header() {
  return (
    <header className="border-b border-border py-3.5">
      <div className="max-w-[1100px] mx-auto px-6 flex items-center justify-between">
        <Link to="/" className="font-mono text-[13px] font-medium text-primary/70 no-underline tracking-wide hover:text-primary transition-colors">
          negative-support
        </Link>
        <nav className="flex gap-5">
          <Link to="/generate" className="font-mono text-[11px] tracking-[0.08em] text-primary/35 no-underline transition-colors hover:text-primary/60">Generate</Link>
          <Link to="/docs" className="font-mono text-[11px] tracking-[0.08em] text-primary/35 no-underline transition-colors hover:text-primary/60">Docs</Link>
          <Link to="/#pricing" className="font-mono text-[11px] tracking-[0.08em] text-primary/35 no-underline transition-colors hover:text-primary/60">Pricing</Link>
        </nav>
      </div>
    </header>
  );
}
