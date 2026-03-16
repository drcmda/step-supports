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

-- Link licenses to users + track runs
ALTER TABLE licenses ADD COLUMN user_id INTEGER REFERENCES users(id);
ALTER TABLE licenses ADD COLUMN runs_used INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_licenses_user_id ON licenses(user_id);
