/**
 * GitHub OAuth + session management for negative-support.
 *
 * Endpoints:
 *   GET  /api/auth/github          — redirect to GitHub OAuth
 *   GET  /api/auth/github/callback  — exchange code, create session
 *   GET  /api/auth/me               — return current user + license
 *   POST /api/auth/logout           — destroy session
 */

import type { Env } from "./api";

// ── Constants ────────────────────────────────────────────────────────

const GITHUB_AUTHORIZE = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN = "https://github.com/login/oauth/access_token";
const GITHUB_USER = "https://api.github.com/user";
const GITHUB_EMAILS = "https://api.github.com/user/emails";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds
const FREE_RUNS = 10;

// ── Helpers ──────────────────────────────────────────────────────────

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

function generateToken(): string {
  return `ns_live_${randomHex(16)}`;
}

function now(): string {
  return new Date().toISOString();
}

function cookieHeader(name: string, value: string, maxAge: number): string {
  return `${name}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

// ── Session helper (exported for use by other handlers) ──────────────

export interface SessionUser {
  id: number;
  github_id: number;
  github_login: string;
  email: string | null;
  avatar_url: string | null;
}

export async function getSessionUser(request: Request, env: Env): Promise<SessionUser | null> {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/(?:^|;\s*)session=([a-f0-9]{64})/);
  if (!match) return null;

  const sessionId = match[1];
  const row = await env.DB.prepare(
    `SELECT u.id, u.github_id, u.github_login, u.email, u.avatar_url, s.expires_at
     FROM sessions s JOIN users u ON s.user_id = u.id
     WHERE s.session_id = ?`
  )
    .bind(sessionId)
    .first<{ id: number; github_id: number; github_login: string; email: string | null; avatar_url: string | null; expires_at: string }>();

  if (!row) return null;

  // Check expiry
  if (new Date(row.expires_at) < new Date()) {
    // Lazily delete expired session
    await env.DB.prepare(`DELETE FROM sessions WHERE session_id = ?`).bind(sessionId).run();
    return null;
  }

  return { id: row.id, github_id: row.github_id, github_login: row.github_login, email: row.email, avatar_url: row.avatar_url };
}

// ── Route: GET /api/auth/github ──────────────────────────────────────

export async function handleGitHubLogin(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const state = randomHex(16);
  const redirectUri = `${url.origin}/api/auth/github/callback`;

  const authUrl = new URL(GITHUB_AUTHORIZE);
  authUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", "read:user user:email");
  authUrl.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authUrl.toString(),
      "Set-Cookie": cookieHeader("oauth_state", state, 600), // 10 min
    },
  });
}

// ── Route: GET /api/auth/github/callback ─────────────────────────────

export async function handleGitHubCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  // Verify state
  const cookie = request.headers.get("Cookie") || "";
  const stateMatch = cookie.match(/(?:^|;\s*)oauth_state=([a-f0-9]{32})/);
  if (!code || !state || !stateMatch || stateMatch[1] !== state) {
    return new Response("Invalid OAuth state", { status: 400 });
  }

  // Exchange code for access token
  const tokenResp = await fetch(GITHUB_TOKEN, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  const tokenData = (await tokenResp.json()) as { access_token?: string; error?: string };
  if (!tokenData.access_token) {
    return new Response(`GitHub auth failed: ${tokenData.error || "unknown"}`, { status: 400 });
  }

  const ghToken = tokenData.access_token;

  // Fetch user profile
  const userResp = await fetch(GITHUB_USER, {
    headers: { Authorization: `Bearer ${ghToken}`, "User-Agent": "negative-support" },
  });
  const ghUser = (await userResp.json()) as {
    id: number;
    login: string;
    email: string | null;
    avatar_url: string;
  };

  // If no public email, fetch from emails endpoint
  let email = ghUser.email;
  if (!email) {
    const emailsResp = await fetch(GITHUB_EMAILS, {
      headers: { Authorization: `Bearer ${ghToken}`, "User-Agent": "negative-support" },
    });
    const emails = (await emailsResp.json()) as { email: string; primary: boolean; verified: boolean }[];
    const primary = emails.find((e) => e.primary && e.verified);
    email = primary?.email ?? emails.find((e) => e.verified)?.email ?? null;
  }

  const ts = now();

  // Upsert user
  await env.DB.prepare(
    `INSERT INTO users (github_id, github_login, email, avatar_url, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(github_id) DO UPDATE SET
       github_login = excluded.github_login,
       email = excluded.email,
       avatar_url = excluded.avatar_url`
  )
    .bind(ghUser.id, ghUser.login, email, ghUser.avatar_url, ts)
    .run();

  // Get user ID
  const user = await env.DB.prepare(`SELECT id FROM users WHERE github_id = ?`)
    .bind(ghUser.id)
    .first<{ id: number }>();

  if (!user) {
    return new Response("Failed to create user", { status: 500 });
  }

  // Auto-link any existing licenses by email
  if (email) {
    await env.DB.prepare(
      `UPDATE licenses SET user_id = ? WHERE LOWER(email) = LOWER(?) AND user_id IS NULL`
    )
      .bind(user.id, email)
      .run();
  }

  // Check if user already has a license (from auto-link or previous login)
  const existingLicense = await env.DB.prepare(
    `SELECT token FROM licenses WHERE user_id = ? LIMIT 1`
  )
    .bind(user.id)
    .first();

  // If no license exists, create a free-tier one
  if (!existingLicense) {
    const token = generateToken();
    await env.DB.prepare(
      `INSERT INTO licenses (token, email, plan, user_id, runs_used, created_at)
       VALUES (?, ?, 'free', ?, 0, ?)`
    )
      .bind(token, email || "unknown", user.id, ts)
      .run();
  }

  // Create session
  const sessionId = randomHex(32);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString();
  await env.DB.prepare(
    `INSERT INTO sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`
  )
    .bind(sessionId, user.id, ts, expiresAt)
    .run();

  // Redirect to generate page
  const headers = new Headers();
  headers.append("Location", `${url.origin}/generate`);
  headers.append("Set-Cookie", cookieHeader("session", sessionId, SESSION_MAX_AGE));
  headers.append("Set-Cookie", cookieHeader("oauth_state", "", 0)); // clear state cookie

  return new Response(null, { status: 302, headers });
}

// ── Route: GET /api/auth/me ──────────────────────────────────────────

export async function handleMe(request: Request, env: Env): Promise<Response> {
  const user = await getSessionUser(request, env);
  if (!user) {
    return json({ user: null });
  }

  // Get license info
  const license = await env.DB.prepare(
    `SELECT token, plan, runs_used FROM licenses WHERE user_id = ? LIMIT 1`
  )
    .bind(user.id)
    .first<{ token: string; plan: string; runs_used: number }>();

  const freeRemaining = license
    ? license.plan === "lifetime"
      ? -1 // unlimited
      : Math.max(0, FREE_RUNS - license.runs_used)
    : 0;

  return json({
    user: {
      login: user.github_login,
      email: user.email,
      avatar_url: user.avatar_url,
    },
    license: license
      ? { token: license.token, plan: license.plan, runs_used: license.runs_used }
      : null,
    freeRemaining,
  });
}

// ── Route: POST /api/auth/logout ─────────────────────────────────────

export async function handleLogout(request: Request, env: Env): Promise<Response> {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/(?:^|;\s*)session=([a-f0-9]{64})/);
  if (match) {
    await env.DB.prepare(`DELETE FROM sessions WHERE session_id = ?`).bind(match[1]).run();
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookieHeader("session", "", 0),
    },
  });
}
