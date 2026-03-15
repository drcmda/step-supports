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
    <div className="landing">
      {/* Hero */}
      <section className="hero">
        <div className="container">
          <h1>Negative-space 3D print supports</h1>
          <p className="hero-sub">
            Generate precision support structures that fit perfectly around your
            model. Works with STEP and STL files.
          </p>
          <div className="hero-actions">
            <a href="/docs" className="btn btn-secondary">
              Get started
            </a>
            <a href="#pricing" className="btn btn-primary">
              Buy license
            </a>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="how-it-works">
        <div className="container">
          <h2>How it works</h2>
          <div className="steps-grid">
            <div className="step">
              <div className="step-num">1</div>
              <h3>Install</h3>
              <code>pip install negative-support</code>
            </div>
            <div className="step">
              <div className="step-num">2</div>
              <h3>Run</h3>
              <code>negative-support model.stl</code>
            </div>
            <div className="step">
              <div className="step-num">3</div>
              <h3>Print</h3>
              <p>Import the support STL alongside your model in your slicer.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features">
        <div className="container">
          <h2>Features</h2>
          <div className="features-grid">
            <div className="feature">
              <h3>STEP overhang detection</h3>
              <p>
                Uses B-Rep face topology to detect exactly which surfaces need
                support. Only generates supports where needed.
              </p>
            </div>
            <div className="feature">
              <h3>Mesh full-shell mode</h3>
              <p>
                Works with any mesh format (STL, OBJ, PLY, 3MF). Creates
                complete negative-space supports around the entire model.
              </p>
            </div>
            <div className="feature">
              <h3>Precision gap control</h3>
              <p>
                Configurable margin between supports and model (default 0.2mm).
                Supports snap off cleanly after printing.
              </p>
            </div>
            <div className="feature">
              <h3>Fast boolean engine</h3>
              <p>
                Powered by manifold3d for fast, robust mesh boolean operations.
                Handles complex geometries reliably.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="pricing" id="pricing">
        <div className="container">
          <h2>Pricing</h2>
          <div className="pricing-cards">
            <div className="pricing-card">
              <h3>Free</h3>
              <div className="price">$0</div>
              <ul>
                <li>3 runs per machine</li>
                <li>All features included</li>
                <li>No account needed</li>
              </ul>
              <a href="/docs" className="btn btn-secondary">
                Get started
              </a>
            </div>
            <div className="pricing-card featured">
              <h3>Lifetime</h3>
              <div className="price">
                $29 <span className="price-note">one-time</span>
              </div>
              <ul>
                <li>Unlimited runs</li>
                <li>Up to 3 machines</li>
                <li>All future updates</li>
              </ul>
              <button
                className="btn btn-primary"
                onClick={handleBuy}
                disabled={loading}
              >
                {loading ? "Redirecting..." : "Buy now"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
