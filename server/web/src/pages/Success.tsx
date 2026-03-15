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
    <div className="success-page">
      <div className="container">
        <h1>Payment successful!</h1>

        {loading && <p className="loading">Retrieving your license token...</p>}

        {error && (
          <div className="error-box">
            <p>{error}</p>
            <p>
              If your payment went through, please refresh in a few seconds.
              Contact support if this persists.
            </p>
          </div>
        )}

        {token && (
          <>
            <p>Here is your license token:</p>
            <CopyToken token={token} />
            <div className="activate-instructions">
              <h2>Activate your license</h2>
              <p>Run this command in your terminal:</p>
              <div className="code-block">
                <code>negative-support --activate {token}</code>
              </div>
              <p className="hint">
                Your token works on up to 3 machines. Keep it safe — you can
                always find it in <code>~/.negative-support/license.json</code>.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
