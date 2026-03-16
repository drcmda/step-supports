export interface User {
  login: string;
  email: string | null;
  avatar_url: string | null;
}

export interface License {
  token: string;
  plan: string;
  runs_used: number;
}

export interface AuthState {
  user: User | null;
  license: License | null;
  freeRemaining: number;
}

export async function fetchMe(): Promise<AuthState> {
  try {
    const resp = await fetch("/api/auth/me", { credentials: "include" });
    const data = await resp.json();
    return {
      user: data.user || null,
      license: data.license || null,
      freeRemaining: data.freeRemaining ?? 0,
    };
  } catch {
    return { user: null, license: null, freeRemaining: 0 };
  }
}

export function loginUrl(): string {
  return "/api/auth/github";
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
}
