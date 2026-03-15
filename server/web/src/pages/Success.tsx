import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import CopyToken from "../components/CopyToken";

export default function Success() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      setError("No session ID found.");
      setLoading(false);
      return;
    }

    const fetchToken = async () => {
      try {
        const resp = await fetch(`/api/token?session_id=${sessionId}`);
        const data = await resp.json();
        if (data.token) {
          setToken(data.token);
        } else {
          setError(data.error || "Token not found.");
        }
      } catch {
        setError("Failed to fetch token. Please try refreshing.");
      } finally {
        setLoading(false);
      }
    };

    // Stripe webhook may take a moment to fire
    const timer = setTimeout(fetchToken, 1500);
    return () => clearTimeout(timer);
  }, [sessionId]);

  return (
    <div className="py-24">
      <div className="max-w-[1100px] mx-auto px-6 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-accent/20 bg-accent-glow mb-6">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-accent">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold mb-2 tracking-[-0.01em]">Payment successful</h1>
        <p className="text-dim text-sm mb-8">Your lifetime license is ready.</p>

        {loading && (
          <div className="flex items-center justify-center gap-2 text-dim text-sm">
            <div className="w-4 h-4 border-2 border-border border-t-accent rounded-full animate-spin" />
            Retrieving your license token...
          </div>
        )}

        {error && (
          <div className="rounded-xl px-5 py-4 max-w-[500px] mx-auto border border-red-500/20 bg-red-500/5">
            <p className="text-red-400 text-sm">{error}</p>
            <p className="text-red-400/60 text-xs mt-1">
              If your payment went through, please refresh in a few seconds.
            </p>
          </div>
        )}

        {token && (
          <>
            <p className="text-dim text-sm mb-2">Your license token:</p>
            <CopyToken token={token} />
            <div className="max-w-[500px] mx-auto mt-10 text-left">
              <p className="label-xs mb-4 tracking-[0.14em]">Activate</p>
              <p className="text-dim text-sm mb-3 leading-relaxed">Run this command in your terminal:</p>
              <div className="bg-base/60 border border-border rounded-lg px-4 py-3 overflow-x-auto">
                <code className="font-mono text-xs text-accent whitespace-pre">negative-support --activate {token}</code>
              </div>
              <p className="text-muted text-xs font-mono mt-4 leading-relaxed">
                Works on up to 3 machines. Token stored in ~/.negative-support/license.json
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
