-- Machine free-tier tracking
CREATE TABLE IF NOT EXISTS machines (
  machine_id TEXT PRIMARY KEY,
  runs_used INTEGER NOT NULL DEFAULT 0,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL
);

-- Users (GitHub OAuth)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  github_id INTEGER NOT NULL UNIQUE,
  github_login TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  created_at TEXT NOT NULL
);

-- Sessions (cookie-based)
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- License tokens (issued on signup or after Stripe payment)
CREATE TABLE IF NOT EXISTS licenses (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  stripe_session_id TEXT,
  user_id INTEGER REFERENCES users(id),
  runs_used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_licenses_stripe_session
  ON licenses(stripe_session_id);

-- Token-to-machine bindings (max 3 per token)
CREATE TABLE IF NOT EXISTS machine_licenses (
  token TEXT NOT NULL,
  machine_id TEXT NOT NULL,
  activated_at TEXT NOT NULL,
  PRIMARY KEY (token, machine_id),
  FOREIGN KEY (token) REFERENCES licenses(token)
);
