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
    <div className="py-20">
      <div className="max-w-[960px] mx-auto px-6">
        <h1 className="text-3xl mb-6 text-center">Payment successful!</h1>

        {loading && <p className="text-center text-dim">Retrieving your license token...</p>}

        {error && (
          <div className="bg-[#1a0000] border border-[#5c1a1a] rounded-lg p-5 max-w-[500px] mx-auto">
            <p className="text-[#fca5a5] text-sm">{error}</p>
            <p className="text-[#fca5a5] text-sm">
              If your payment went through, please refresh in a few seconds.
              Contact support if this persists.
            </p>
          </div>
        )}

        {token && (
          <>
            <p>Here is your license token:</p>
            <CopyToken token={token} />
            <div className="max-w-[500px] mx-auto mt-8">
              <h2 className="text-xl mb-3">Activate your license</h2>
              <p className="text-dim mb-3">Run this command in your terminal:</p>
              <div className="bg-surface border border-border rounded-lg p-4 my-3 overflow-x-auto">
                <code className="font-mono text-sm text-green-500 whitespace-pre">negative-support --activate {token}</code>
              </div>
              <p className="text-dim text-sm mt-3">
                Your token works on up to 3 machines. Keep it safe — you can
                always find it in <code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded">~/.negative-support/license.json</code>.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
