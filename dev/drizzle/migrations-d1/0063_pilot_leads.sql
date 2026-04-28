-- Pilot lead capture from /for-hiring-managers wedge page
CREATE TABLE pilot_leads (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  company TEXT,
  role TEXT,
  hires_per_year INTEGER,
  current_tool TEXT,
  notes TEXT,
  source TEXT DEFAULT 'for-hiring-managers',
  ip TEXT,
  user_agent TEXT,
  status TEXT DEFAULT 'new' NOT NULL, -- 'new' | 'contacted' | 'qualified' | 'rejected'
  created_at TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE INDEX idx_pilot_leads_email ON pilot_leads(email);
CREATE INDEX idx_pilot_leads_status ON pilot_leads(status);
CREATE INDEX idx_pilot_leads_created_at ON pilot_leads(created_at);
