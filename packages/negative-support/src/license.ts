/**
 * License management for negative-support (Node.js CLI).
 *
 * Shares config files with the Python CLI at ~/.negative-support/.
 * Free tier: 3 runs per machine. After that, requires a paid license token.
 */

import { createHash } from 'crypto';
import { hostname, platform, arch, networkInterfaces, userInfo } from 'os';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// ── Configuration ─────────────────────────────────────────────────────

const FREE_RUNS = 3;
const TOKEN_PREFIX = 'ns_live_';
const API_BASE = process.env.NS_API_BASE || 'https://negative.support';
const BUY_URL = 'https://negative.support';
const GRACE_DAYS = 7;
const CONFIG_DIR = join(homedir(), '.negative-support');
const USAGE_FILE = join(CONFIG_DIR, 'usage.json');
const LICENSE_FILE = join(CONFIG_DIR, 'license.json');

// ── Machine fingerprint ───────────────────────────────────────────────

function getMachineId(): string {
  // Match Python: SHA-256 of hostname|MAC|OS|arch|username
  const mac = getMacAddress();
  const parts = [
    hostname(),
    mac,
    platform(),
    arch(),
    userInfo().username,
  ];
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

function getMacAddress(): string {
  // Match Python's uuid.getnode() — returns MAC as decimal integer string
  const ifaces = networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]!) {
      if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
        // Convert MAC to integer like Python's uuid.getnode()
        const hex = iface.mac.replace(/:/g, '');
        return BigInt('0x' + hex).toString();
      }
    }
  }
  return '0';
}

// ── Local storage ─────────────────────────────────────────────────────

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
}

function readJson(path: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

function writeJson(path: string, data: Record<string, unknown>): void {
  ensureConfigDir();
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

// ── Server communication ─────────────────────────────────────────────

async function apiPost(endpoint: string, body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const url = `${API_BASE}${endpoint}`;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    return await resp.json() as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ── Free tier ─────────────────────────────────────────────────────────

async function checkFreeTierServer(machineId: string): Promise<number | null> {
  const resp = await apiPost('/api/free-tier', { machine_id: machineId });
  if (resp && typeof resp.free_remaining === 'number') return resp.free_remaining;
  return null;
}

function checkFreeTierLocal(machineId: string): number {
  const usage = readJson(USAGE_FILE);
  if (!usage || usage.machine_id !== machineId) {
    const newUsage = {
      machine_id: machineId,
      runs_used: 0,
      first_run: new Date().toISOString(),
    };
    writeJson(USAGE_FILE, newUsage);
    return FREE_RUNS;
  }
  const runsUsed = (usage.runs_used as number) || 0;
  return Math.max(0, FREE_RUNS - runsUsed);
}

function consumeFreeRunLocal(machineId: string): void {
  const usage = readJson(USAGE_FILE) || {};
  usage.machine_id = machineId;
  usage.runs_used = ((usage.runs_used as number) || 0) + 1;
  usage.last_run = new Date().toISOString();
  writeJson(USAGE_FILE, usage);
}

// ── Token validation ─────────────────────────────────────────────────

function isValidTokenFormat(token: string): boolean {
  if (!token.startsWith(TOKEN_PREFIX)) return false;
  const hex = token.slice(TOKEN_PREFIX.length);
  return hex.length === 32 && /^[0-9a-f]+$/.test(hex);
}

async function validateLicense(): Promise<[boolean, string]> {
  const lic = readJson(LICENSE_FILE);
  if (!lic || typeof lic.token !== 'string') return [false, ''];

  const token = lic.token as string;
  if (!isValidTokenFormat(token)) return [false, 'Invalid token format.'];

  // Try server validation
  const resp = await apiPost('/api/validate', { token });
  if (resp !== null) {
    if (resp.valid) {
      lic.last_validated = new Date().toISOString();
      lic.plan = (resp.plan as string) || 'lifetime';
      writeJson(LICENSE_FILE, lic);
      return [true, `Licensed (${lic.plan})`];
    } else {
      return [false, (resp.error as string) || 'Token is no longer valid.'];
    }
  }

  // Server unreachable — check grace period
  const lastValidated = lic.last_validated as string | undefined;
  if (lastValidated) {
    try {
      const lastDt = new Date(lastValidated);
      const daysOffline = Math.floor((Date.now() - lastDt.getTime()) / 86400000);
      if (daysOffline <= GRACE_DAYS) {
        return [true, `Licensed (offline, validated ${daysOffline}d ago)`];
      } else {
        return [false, `License not validated in ${daysOffline} days. Connect to the internet to re-validate.`];
      }
    } catch { /* fall through */ }
  }

  return [false, 'Cannot validate license (server unreachable).'];
}

// ── Public API ────────────────────────────────────────────────────────

export async function checkLicense(): Promise<[boolean, string]> {
  // Check paid license first
  const [hasLicense, msg] = await validateLicense();
  if (hasLicense) return [true, msg];

  // Check free tier
  const machineId = getMachineId();

  // Try server first (prevents reinstall abuse)
  const serverRemaining = await checkFreeTierServer(machineId);
  if (serverRemaining !== null) {
    if (serverRemaining > 0) {
      consumeFreeRunLocal(machineId);
      const remaining = serverRemaining - 1;
      return [true, `Free tier (${remaining} run${remaining !== 1 ? 's' : ''} remaining)`];
    } else {
      return [false, ''];
    }
  }

  // Server unreachable — use local count
  const localRemaining = checkFreeTierLocal(machineId);
  if (localRemaining > 0) {
    consumeFreeRunLocal(machineId);
    const remaining = localRemaining - 1;
    return [true, `Free tier (${remaining} run${remaining !== 1 ? 's' : ''} remaining)`];
  }
  return [false, ''];
}

export async function activateToken(token: string): Promise<[boolean, string]> {
  token = token.trim();
  if (!isValidTokenFormat(token)) {
    return [false, `Invalid token format. Expected: ${TOKEN_PREFIX}<32 hex characters>\nExample: ${TOKEN_PREFIX}${'a1b2c3d4'.repeat(4)}`];
  }

  const machineId = getMachineId();
  const resp = await apiPost('/api/activate', { token, machine_id: machineId });
  const now = new Date().toISOString();
  const lic: Record<string, unknown> = {
    token,
    activated_at: now,
    last_validated: now,
    plan: 'lifetime',
  };

  if (resp !== null) {
    if (resp.ok) {
      lic.plan = (resp.plan as string) || 'lifetime';
      writeJson(LICENSE_FILE, lic);
      return [true, `License activated! Plan: ${lic.plan}`];
    } else {
      return [false, (resp.error as string) || 'Server rejected this token.'];
    }
  }

  // Server unreachable — save locally
  writeJson(LICENSE_FILE, lic);
  return [true, 'Token saved. Could not reach server for validation — it will be verified on next online run.'];
}

export async function getStatus(): Promise<string> {
  const lines: string[] = [];
  const lic = readJson(LICENSE_FILE);

  if (lic && typeof lic.token === 'string') {
    const token = lic.token as string;
    const masked = token.length > 12 ? token.slice(0, 8) + '...' + token.slice(-4) : token;
    lines.push(`Token:      ${masked}`);
    lines.push(`Plan:       ${lic.plan || 'unknown'}`);
    lines.push(`Activated:  ${lic.activated_at || 'unknown'}`);
    lines.push(`Validated:  ${lic.last_validated || 'never'}`);

    const [valid, msg] = await validateLicense();
    lines.push(`Status:     ${valid ? 'valid' : 'invalid'} — ${msg}`);
  } else {
    lines.push('Token:      none');
    const machineId = getMachineId();
    const localRemaining = checkFreeTierLocal(machineId);
    lines.push(`Free runs:  ${localRemaining} remaining`);
    lines.push(`Machine ID: ${machineId.slice(0, 16)}...`);
  }

  return lines.join('\n');
}

export function openBuyPage(): void {
  const machineId = getMachineId();
  const url = `${BUY_URL}?machine=${machineId}`;
  console.log(`Opening ${url}`);
  import('child_process').then(cp => cp.exec(`open "${url}" || xdg-open "${url}" || start "${url}"`));
}

export function printBuyMessage(): void {
  console.log();
  console.log('  Free tier exhausted (3/3 runs used).');
  console.log();
  console.log('  To continue using negative-support, purchase a license:');
  console.log(`    ${BUY_URL}`);
  console.log('  or run: negative-support --buy');
  console.log();
  console.log('  After purchasing, activate your token:');
  console.log('    negative-support --activate <your-token>');
  console.log();
}
