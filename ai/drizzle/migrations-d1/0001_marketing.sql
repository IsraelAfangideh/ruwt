CREATE TABLE site_visitors (
  id TEXT PRIMARY KEY,
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  visit_count INTEGER NOT NULL DEFAULT 1,
  first_referrer TEXT,
  first_user_agent TEXT,
  visitor_kind TEXT NOT NULL DEFAULT 'unknown'
);

CREATE TABLE site_visits (
  id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL REFERENCES site_visitors(id),
  path TEXT NOT NULL DEFAULT '/',
  referrer TEXT,
  user_agent TEXT,
  visitor_kind TEXT NOT NULL DEFAULT 'unknown',
  is_new_visitor INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_site_visits_visitor ON site_visits(visitor_id);
CREATE INDEX idx_site_visits_created ON site_visits(created_at DESC);

CREATE TABLE site_stats (
  id TEXT PRIMARY KEY DEFAULT 'global',
  total_visits INTEGER NOT NULL DEFAULT 0,
  unique_visitors INTEGER NOT NULL DEFAULT 0,
  total_download_clicks INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO site_stats (id, total_visits, unique_visitors, total_download_clicks)
VALUES ('global', 0, 0, 0);

CREATE TABLE download_clicks (
  id TEXT PRIMARY KEY,
  visitor_id TEXT,
  platform TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'header',
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_download_clicks_created ON download_clicks(created_at DESC);
