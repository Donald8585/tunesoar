-- schema.sql — run with: wrangler d1 execute attunely --file=./schema.sql

CREATE TABLE IF NOT EXISTS licenses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  plan TEXT NOT NULL,                   -- 'monthly' | 'lifetime'
  key TEXT UNIQUE NOT NULL,
  devices TEXT DEFAULT '[]',           -- JSON array of device fingerprints
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  active INTEGER DEFAULT 1
);
