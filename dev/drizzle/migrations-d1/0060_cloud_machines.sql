CREATE TABLE IF NOT EXISTS cloud_machines (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id),
  fly_machine_id TEXT NOT NULL,
  bridge_token TEXT NOT NULL,
  spec TEXT DEFAULT 'light' NOT NULL,
  status TEXT DEFAULT 'stopped' NOT NULL,
  region TEXT DEFAULT 'iad' NOT NULL,
  last_active_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cloud_machines_user ON cloud_machines(user_id);
