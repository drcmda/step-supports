import { Link } from "react-router-dom";

export default function Header() {
  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="logo">
          negative-support
        </Link>
        <nav className="nav">
          <Link to="/docs">Docs</Link>
          <Link to="/#pricing">Pricing</Link>
        </nav>
      </div>
    </header>
  );
}
