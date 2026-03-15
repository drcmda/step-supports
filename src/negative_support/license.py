"""License management for negative-support.

Free tier: 3 runs per machine. After that, requires a paid license token.
Tracks usage locally in ~/.negative-support/ and validates against a remote
server when available (to prevent reinstall abuse).
"""

from __future__ import annotations

import datetime
import getpass
import hashlib
import json
import os
import platform
import sys
import uuid
import webbrowser
from pathlib import Path
from urllib import request, error as urlerror

# ── Configuration ─────────────────────────────────────────────────────

FREE_RUNS = 3
CONFIG_DIR = Path.home() / ".negative-support"
USAGE_FILE = CONFIG_DIR / "usage.json"
LICENSE_FILE = CONFIG_DIR / "license.json"
TOKEN_PREFIX = "ns_live_"
API_BASE = os.environ.get("NS_API_BASE", "https://negative.support")
BUY_URL = "https://negative.support"
GRACE_DAYS = 7  # allow offline usage for this many days after last validation


# ── Machine fingerprint ───────────────────────────────────────────────

def _get_machine_id() -> str:
    """Generate a stable machine fingerprint.

    SHA-256 of hostname + MAC address + OS + username.
    Survives reinstalls but changes if user switches machines.
    """
    parts = [
        platform.node(),           # hostname
        str(uuid.getnode()),       # MAC address as int
        platform.system(),         # OS
        platform.machine(),        # architecture
        getpass.getuser(),         # username
    ]
    raw = "|".join(parts)
    return hashlib.sha256(raw.encode()).hexdigest()


# ── Local storage ─────────────────────────────────────────────────────

def _ensure_config_dir() -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)


def _read_json(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def _write_json(path: Path, data: dict) -> None:
    _ensure_config_dir()
    path.write_text(json.dumps(data, indent=2) + "\n")


# ── Server communication ─────────────────────────────────────────────

def _api_post(endpoint: str, body: dict, timeout: float = 5.0) -> dict | None:
    """POST JSON to the license server. Returns parsed response or None on failure."""
    url = f"{API_BASE}{endpoint}"
    data = json.dumps(body).encode()
    req = request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read())
    except (urlerror.URLError, OSError, json.JSONDecodeError, TimeoutError):
        return None


# ── Free tier ─────────────────────────────────────────────────────────

def _check_free_tier_server(machine_id: str) -> int | None:
    """Ask server how many free runs remain. Returns count or None if unreachable."""
    resp = _api_post("/api/free-tier", {"machine_id": machine_id})
    if resp and "free_remaining" in resp:
        return resp["free_remaining"]
    return None


def _check_free_tier_local(machine_id: str) -> int:
    """Check local usage file for remaining free runs."""
    usage = _read_json(USAGE_FILE)
    if usage is None or usage.get("machine_id") != machine_id:
        # First run or different machine — initialize
        usage = {
            "machine_id": machine_id,
            "runs_used": 0,
            "first_run": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }
        _write_json(USAGE_FILE, usage)

    runs_used = usage.get("runs_used", 0)
    return max(0, FREE_RUNS - runs_used)


def _consume_free_run_local(machine_id: str) -> None:
    """Decrement local free run counter."""
    usage = _read_json(USAGE_FILE) or {}
    usage["machine_id"] = machine_id
    usage["runs_used"] = usage.get("runs_used", 0) + 1
    usage["last_run"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    _write_json(USAGE_FILE, usage)


# ── Token validation ─────────────────────────────────────────────────

def _is_valid_token_format(token: str) -> bool:
    """Check if token matches expected format: ns_live_<32 hex chars>."""
    if not token.startswith(TOKEN_PREFIX):
        return False
    hex_part = token[len(TOKEN_PREFIX):]
    return len(hex_part) == 32 and all(c in "0123456789abcdef" for c in hex_part)


def _validate_token_server(token: str) -> dict | None:
    """Validate token with server. Returns response or None if unreachable."""
    return _api_post("/api/validate", {"token": token})


def _validate_license() -> tuple[bool, str]:
    """Check if a valid paid license exists.

    Returns (is_valid, message).
    """
    lic = _read_json(LICENSE_FILE)
    if lic is None or "token" not in lic:
        return False, ""

    token = lic["token"]
    if not _is_valid_token_format(token):
        return False, "Invalid token format."

    # Try server validation
    resp = _validate_token_server(token)
    if resp is not None:
        if resp.get("valid"):
            # Update last validated timestamp
            lic["last_validated"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
            lic["plan"] = resp.get("plan", "lifetime")
            _write_json(LICENSE_FILE, lic)
            return True, f"Licensed ({lic['plan']})"
        else:
            return False, resp.get("error", "Token is no longer valid.")

    # Server unreachable — check grace period
    last_validated = lic.get("last_validated")
    if last_validated:
        try:
            last_dt = datetime.datetime.fromisoformat(last_validated)
            now = datetime.datetime.now(datetime.timezone.utc)
            days_offline = (now - last_dt).days
            if days_offline <= GRACE_DAYS:
                return True, f"Licensed (offline, validated {days_offline}d ago)"
            else:
                return False, (
                    f"License not validated in {days_offline} days. "
                    "Connect to the internet to re-validate."
                )
        except (ValueError, TypeError):
            pass

    return False, "Cannot validate license (server unreachable)."


# ── Public API ────────────────────────────────────────────────────────

def check_license() -> tuple[bool, str]:
    """Check if the user is allowed to run.

    Returns (allowed, message).
    Priority:
      1. Valid paid token → allowed
      2. Free runs remaining → allowed (decrements counter)
      3. No runs left → blocked with buy message
    """
    # Check paid license first
    has_license, msg = _validate_license()
    if has_license:
        return True, msg

    # Check free tier
    machine_id = _get_machine_id()

    # Try server first (prevents reinstall abuse)
    server_remaining = _check_free_tier_server(machine_id)
    if server_remaining is not None:
        if server_remaining > 0:
            _consume_free_run_local(machine_id)
            remaining = server_remaining - 1
            return True, f"Free tier ({remaining} run{'s' if remaining != 1 else ''} remaining)"
        else:
            return False, ""
    else:
        # Server unreachable — use local count
        local_remaining = _check_free_tier_local(machine_id)
        if local_remaining > 0:
            _consume_free_run_local(machine_id)
            remaining = local_remaining - 1
            return True, f"Free tier ({remaining} run{'s' if remaining != 1 else ''} remaining)"
        else:
            return False, ""


def activate_token(token: str) -> tuple[bool, str]:
    """Activate a license token.

    Returns (success, message).
    """
    token = token.strip()
    if not _is_valid_token_format(token):
        return False, (
            f"Invalid token format. Expected: {TOKEN_PREFIX}<32 hex characters>\n"
            f"Example: {TOKEN_PREFIX}{'a1b2c3d4' * 4}"
        )

    # Try server activation
    machine_id = _get_machine_id()
    resp = _api_post("/api/activate", {"token": token, "machine_id": machine_id})

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    lic = {
        "token": token,
        "activated_at": now,
        "last_validated": now,
        "plan": "lifetime",
    }

    if resp is not None:
        if resp.get("ok"):
            lic["plan"] = resp.get("plan", "lifetime")
            _write_json(LICENSE_FILE, lic)
            return True, f"License activated! Plan: {lic['plan']}"
        else:
            return False, resp.get("error", "Server rejected this token.")
    else:
        # Server unreachable — save locally, validate later
        _write_json(LICENSE_FILE, lic)
        return True, (
            "Token saved. Could not reach server for validation — "
            "it will be verified on next online run."
        )


def get_status() -> str:
    """Get a human-readable license status string."""
    lines = []

    # Check paid license
    lic = _read_json(LICENSE_FILE)
    if lic and "token" in lic:
        token = lic["token"]
        masked = token[:8] + "..." + token[-4:] if len(token) > 12 else token
        lines.append(f"Token:      {masked}")
        lines.append(f"Plan:       {lic.get('plan', 'unknown')}")
        lines.append(f"Activated:  {lic.get('activated_at', 'unknown')}")
        lines.append(f"Validated:  {lic.get('last_validated', 'never')}")

        valid, msg = _validate_license()
        lines.append(f"Status:     {'valid' if valid else 'invalid'} — {msg}")
    else:
        lines.append("Token:      none")
        machine_id = _get_machine_id()
        local_remaining = _check_free_tier_local(machine_id)
        lines.append(f"Free runs:  {local_remaining} remaining")
        lines.append(f"Machine ID: {machine_id[:16]}...")

    return "\n".join(lines)


def open_buy_page() -> None:
    """Open the purchase page in the user's browser."""
    machine_id = _get_machine_id()
    url = f"{BUY_URL}?machine={machine_id}"
    print(f"Opening {url}")
    webbrowser.open(url)


def print_buy_message() -> None:
    """Print the message shown when free tier is exhausted."""
    print()
    print("  Free tier exhausted (3/3 runs used).")
    print()
    print("  To continue using negative-support, purchase a license:")
    print(f"    {BUY_URL}")
    print("  or run: negative-support --buy")
    print()
    print("  After purchasing, activate your token:")
    print("    negative-support --activate <your-token>")
    print()
