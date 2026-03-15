/**
 * API route handlers for the negative-support licensing server.
 *
 * Endpoints:
 *   POST /api/free-tier      — track machine runs, return remaining
 *   POST /api/validate       — check token validity
 *   POST /api/activate       — bind token to machine (max 3)
 *   POST /api/webhook/stripe — handle Stripe payment, generate token
 *   GET  /api/token           — fetch token by Stripe session ID
 *   POST /api/checkout        — create Stripe Checkout Session
 */

// ── Types ────────────────────────────────────────────────────────────

export interface Env {
  DB: D1Database;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  RESEND_API_KEY: string;
}

// ── Constants ────────────────────────────────────────────────────────

const FREE_RUNS = 3;
const MAX_MACHINES_PER_TOKEN = 3;
const STRIPE_API = "https://api.stripe.com/v1";
const PRICE_ID = "price_1TBB3d9HnoOYYyWYyX2sg3Gq";
const SUCCESS_URL = "https://negative.support/success?session_id={CHECKOUT_SESSION_ID}";
const CANCEL_URL = "https://negative.support/";

// ── Helpers ──────────────────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function isValidMachineId(id: unknown): id is string {
  return typeof id === "string" && /^[a-f0-9]{64}$/.test(id);
}

function isValidToken(token: unknown): token is string {
  return typeof token === "string" && /^ns_live_[a-f0-9]{32}$/.test(token);
}

function generateToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `ns_live_${hex}`;
}

function now(): string {
  return new Date().toISOString();
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// ── Stripe helpers ───────────────────────────────────────────────────

async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string
): Promise<boolean> {
  const parts = sigHeader.split(",");
  const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
  const signatures = parts
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3));

  if (!timestamp || signatures.length === 0) return false;

  // Reject events older than 5 minutes
  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
  if (Math.abs(age) > 300) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedPayload)
  );
  const expected = Array.from(new Uint8Array(sig), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");

  // Constant-time comparison
  return signatures.some((s) => timingSafeEqual(s, expected));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ── Route handlers ───────────────────────────────────────────────────

export async function handleFreeTier(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  if (!isValidMachineId(body.machine_id)) {
    return json({ error: "Invalid machine_id" }, 400);
  }

  const ts = now();
  const result = await env.DB.prepare(
    `INSERT INTO machines (machine_id, runs_used, first_seen, last_seen)
     VALUES (?, 1, ?, ?)
     ON CONFLICT(machine_id) DO UPDATE SET
       runs_used = CASE WHEN runs_used < ? THEN runs_used + 1 ELSE runs_used END,
       last_seen = ?
     RETURNING runs_used`
  )
    .bind(body.machine_id, ts, ts, FREE_RUNS, ts)
    .first<{ runs_used: number }>();

  const runsUsed = result?.runs_used ?? FREE_RUNS;
  return json({ free_remaining: Math.max(0, FREE_RUNS - runsUsed) });
}

export async function handleValidate(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  if (!isValidToken(body.token)) {
    return json({ valid: false, error: "Invalid token format" }, 400);
  }

  const row = await env.DB.prepare(
    `SELECT plan FROM licenses WHERE token = ?`
  )
    .bind(body.token)
    .first<{ plan: string }>();

  if (!row) {
    return json({ valid: false, error: "Token not found" });
  }

  return json({ valid: true, plan: row.plan });
}

export async function handleActivate(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  if (!isValidToken(body.token)) {
    return json({ ok: false, error: "Invalid token format" }, 400);
  }
  if (!isValidMachineId(body.machine_id)) {
    return json({ ok: false, error: "Invalid machine_id" }, 400);
  }

  // Check token exists
  const license = await env.DB.prepare(
    `SELECT plan FROM licenses WHERE token = ?`
  )
    .bind(body.token)
    .first<{ plan: string }>();

  if (!license) {
    return json({ ok: false, error: "Token not found" });
  }

  // Check machine count
  const count = await env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM machine_licenses WHERE token = ?`
  )
    .bind(body.token)
    .first<{ cnt: number }>();

  if ((count?.cnt ?? 0) >= MAX_MACHINES_PER_TOKEN) {
    // Check if this machine is already activated (re-activation is OK)
    const existing = await env.DB.prepare(
      `SELECT 1 FROM machine_licenses WHERE token = ? AND machine_id = ?`
    )
      .bind(body.token, body.machine_id)
      .first();

    if (!existing) {
      return json({
        ok: false,
        error: `Maximum ${MAX_MACHINES_PER_TOKEN} machines per license`,
      });
    }
  }

  // Bind machine to token
  await env.DB.prepare(
    `INSERT OR IGNORE INTO machine_licenses (token, machine_id, activated_at)
     VALUES (?, ?, ?)`
  )
    .bind(body.token, body.machine_id, now())
    .run();

  return json({ ok: true, plan: license.plan });
}

export async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  const rawBody = await request.text();
  const sigHeader = request.headers.get("Stripe-Signature");

  if (!sigHeader) {
    return json({ error: "Missing signature" }, 400);
  }

  const valid = await verifyStripeSignature(rawBody, sigHeader, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) {
    return json({ error: "Invalid signature" }, 400);
  }

  const event = JSON.parse(rawBody);
  if (event.type !== "checkout.session.completed") {
    return json({ received: true });
  }

  const session = event.data.object;
  const email = session.customer_details?.email ?? session.customer_email ?? "unknown";
  const sessionId = session.id;

  // Idempotent: skip if we already processed this session
  const existing = await env.DB.prepare(
    `SELECT token FROM licenses WHERE stripe_session_id = ?`
  )
    .bind(sessionId)
    .first();

  if (existing) {
    return json({ received: true });
  }

  const token = generateToken();
  await env.DB.prepare(
    `INSERT INTO licenses (token, email, plan, stripe_session_id, created_at)
     VALUES (?, ?, 'lifetime', ?, ?)`
  )
    .bind(token, email, sessionId, now())
    .run();

  return json({ received: true });
}

export async function handleGetToken(url: URL, env: Env): Promise<Response> {
  const sessionId = url.searchParams.get("session_id");
  if (!sessionId) {
    return json({ error: "Missing session_id" }, 400);
  }

  const row = await env.DB.prepare(
    `SELECT token, plan FROM licenses WHERE stripe_session_id = ?`
  )
    .bind(sessionId)
    .first<{ token: string; plan: string }>();

  if (!row) {
    return json({ error: "Session not found" }, 404);
  }

  return json({ token: row.token, plan: row.plan });
}

export async function handleRecover(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email || !email.includes("@")) {
    return json({ error: "Please enter a valid email address." }, 400);
  }

  // Look up token by email
  const row = await env.DB.prepare(
    `SELECT token FROM licenses WHERE LOWER(email) = ? LIMIT 1`
  )
    .bind(email)
    .first<{ token: string }>();

  // Always return success to prevent email enumeration
  if (!row) {
    return json({ ok: true, message: "If a license exists for that email, you'll receive it shortly." });
  }

  // Send email via Resend
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "negative-support <license@negative.support>",
        to: [email],
        subject: "Your negative-support license token",
        html: `<div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 0;">
  <h2 style="font-size: 18px; font-weight: 600; margin-bottom: 16px;">Your license token</h2>
  <p style="color: #666; font-size: 14px; margin-bottom: 24px;">Here's your negative-support lifetime license token:</p>
  <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; font-family: monospace; font-size: 13px; word-break: break-all; margin-bottom: 24px;">${row.token}</div>
  <p style="color: #666; font-size: 14px; margin-bottom: 8px;"><strong>Browser:</strong> Paste this token on the <a href="https://negative.support/generate">generate page</a> to activate.</p>
  <p style="color: #666; font-size: 14px; margin-bottom: 24px;"><strong>CLI:</strong> Run <code style="background: #f5f5f5; padding: 2px 6px; border-radius: 4px; font-size: 12px;">negative-support --activate ${row.token}</code></p>
  <p style="color: #999; font-size: 12px;">Works on up to 3 machines. If you didn't request this, you can ignore this email.</p>
</div>`,
      }),
    });

    if (!resp.ok) {
      console.error("Resend error:", await resp.text());
      return json({ error: "Failed to send email. Please try again." }, 500);
    }
  } catch (err) {
    console.error("Resend fetch error:", err);
    return json({ error: "Failed to send email. Please try again." }, 500);
  }

  return json({ ok: true, message: "If a license exists for that email, you'll receive it shortly." });
}

export async function handleCheckout(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  const machineId = isValidMachineId(body.machine_id) ? body.machine_id : undefined;

  const params = new URLSearchParams({
    mode: "payment",
    "line_items[0][price]": PRICE_ID,
    "line_items[0][quantity]": "1",
    success_url: SUCCESS_URL,
    cancel_url: CANCEL_URL,
  });

  if (machineId) {
    params.set("metadata[machine_id]", machineId);
  }

  const resp = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const session = (await resp.json()) as { url?: string; error?: { message: string } };

  if (!resp.ok || !session.url) {
    return json({ error: session.error?.message ?? "Checkout failed" }, 500);
  }

  return json({ url: session.url });
}
