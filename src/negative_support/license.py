"""License management for negative-support.

Requires a valid license token (ns_live_*) to run. Tokens are issued
when you sign in at https://negative.support. Free tokens get 10 runs,
paid tokens get unlimited.
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
from pathlib import Path
from urllib import request, error as urlerror

# ── Configuration ─────────────────────────────────────────────────────

FREE_RUNS = 10
CONFIG_DIR = Path.home() / ".negative-support"
LICENSE_FILE = CONFIG_DIR / "license.json"
TOKEN_PREFIX = "ns_live_"
API_BASE = os.environ.get("NS_API_BASE", "https://negative.support")
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
    """Check if a valid license exists.

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
            lic["runs_used"] = resp.get("runs_used", 0)
            _write_json(LICENSE_FILE, lic)
            plan = lic["plan"]
            if plan == "lifetime":
                return True, "Licensed (lifetime)"
            else:
                remaining = resp.get("free_remaining", FREE_RUNS - resp.get("runs_used", 0))
                return True, f"Free tier ({remaining} run{'s' if remaining != 1 else ''} remaining)"
        else:
            error = resp.get("error", "Token is no longer valid.")
            if "exhausted" in str(error).lower() or resp.get("runs_used", 0) >= FREE_RUNS:
                return False, "exhausted"
            return False, error

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
    Requires a valid ns_live_* token. No anonymous free tier.
    """
    has_license, msg = _validate_license()
    if has_license:
        return True, msg

    if msg == "exhausted":
        return False, "exhausted"

    # No token found
    return False, "no_token"


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
        lines.append("")
        lines.append("Sign in at https://negative.support to get your token,")
        lines.append("then activate it:")
        lines.append("  negative-support --activate <your-token>")

    return "\n".join(lines)


def print_no_token_message() -> None:
    """Print the message shown when no token is configured."""
    print()
    print("  No license token found.")
    print()
    print("  1. Sign in at https://negative.support")
    print("  2. Copy your token from the user menu")
    print("  3. Run: negative-support --activate <your-token>")
    print()
    print("  Free accounts get 10 runs. Buy a lifetime license for unlimited use.")
    print()


def print_exhausted_message() -> None:
    """Print the message shown when free runs are exhausted."""
    print()
    print(f"  Free tier exhausted ({FREE_RUNS}/{FREE_RUNS} runs used).")
    print()
    print("  To continue, buy a lifetime license at:")
    print("    https://negative.support/#pricing")
    print()
    print("  Your existing token will be upgraded — no re-activation needed.")
    print()
