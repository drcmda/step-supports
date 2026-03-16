const TOKEN_KEY = 'ns_license_token';
const VALID_KEY = 'ns_license_valid';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function storeToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(VALID_KEY, '1');
  } catch {
    // ignore
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(VALID_KEY);
  } catch {
    // ignore
  }
}

export function isTokenFormat(token: string): boolean {
  return /^ns_live_[a-f0-9]{32}$/.test(token);
}

/** Validate token against the server. Caches result in localStorage. */
export async function validateToken(token: string): Promise<boolean> {
  if (!isTokenFormat(token)) return false;

  try {
    const resp = await fetch('/api/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = await resp.json();
    if (data.valid) {
      storeToken(token);
      return true;
    } else {
      clearToken();
      return false;
    }
  } catch {
    // Offline — trust cached validation
    try {
      return localStorage.getItem(VALID_KEY) === '1';
    } catch {
      return false;
    }
  }
}
