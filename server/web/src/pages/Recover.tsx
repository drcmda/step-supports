import { useState, useCallback } from "react";

export default function Recover() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const resp = await fetch("/api/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await resp.json();
      if (data.ok) {
        setSent(true);
      } else {
        setError(data.error || "Something went wrong.");
      }
    } catch {
      setError("Failed to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [email]);

  return (
    <div className="py-24">
      <div className="max-w-[1100px] mx-auto px-6 text-center">
        <p className="label-xs mb-6 tracking-[0.14em]">Account</p>
        <h1 className="text-2xl font-semibold mb-2 tracking-[-0.01em]">Recover your license</h1>
        <p className="text-dim text-sm mb-10 max-w-[420px] mx-auto leading-relaxed">
          Enter the email you used at checkout. We'll send your license token to that address.
        </p>

        {sent ? (
          <div className="rounded-xl p-6 max-w-[420px] mx-auto border border-accent/20 bg-accent-glow">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-accent/20 bg-accent-glow mb-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-accent">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="text-primary text-sm font-medium mb-2">Check your email</p>
            <p className="text-dim text-sm leading-relaxed">
              If a license exists for that email, you'll receive your token shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="max-w-[420px] mx-auto">
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-base/60 border border-border rounded-lg text-primary font-mono text-sm focus:border-accent/40 focus:outline-none transition-colors"
                autoFocus
              />
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 rounded-lg text-sm font-medium bg-accent text-base border-none cursor-pointer hover:brightness-110 transition-all glow-accent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Sending..." : "Send"}
              </button>
            </div>
            {error && (
              <p className="text-red-400 text-xs mt-3 text-left">{error}</p>
            )}
            <p className="text-muted text-xs font-mono mt-6 leading-relaxed">
              Your token is only sent to the email on file — never displayed on screen.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
