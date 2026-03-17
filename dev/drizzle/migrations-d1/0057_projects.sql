CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id),
  name TEXT NOT NULL DEFAULT 'Untitled Project',
  description TEXT DEFAULT '',
  r2_key TEXT NOT NULL,
  language TEXT DEFAULT 'javascript',
  file_count INTEGER DEFAULT 0,
  size_bytes INTEGER DEFAULT 0,
  last_opened_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
