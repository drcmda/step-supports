import { Link } from "react-router-dom";

export default function Header() {
  return (
    <header className="border-b border-border py-4">
      <div className="max-w-[960px] mx-auto px-6 flex items-center justify-between">
        <Link to="/" className="font-mono text-lg font-semibold text-primary no-underline">
          negative-support
        </Link>
        <nav className="flex gap-6">
          <Link to="/try" className="text-dim text-sm no-underline transition-colors hover:text-primary">Generate</Link>
          <Link to="/docs" className="text-dim text-sm no-underline transition-colors hover:text-primary">Docs</Link>
          <Link to="/#pricing" className="text-dim text-sm no-underline transition-colors hover:text-primary">Pricing</Link>
        </nav>
      </div>
    </header>
  );
}
