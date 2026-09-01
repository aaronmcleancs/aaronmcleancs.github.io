-- D1 schema — portfolio analytics
CREATE TABLE IF NOT EXISTS sessions (
  sid       TEXT PRIMARY KEY,
  started   INTEGER NOT NULL,      -- unix seconds
  last_seen INTEGER NOT NULL,
  duration  INTEGER NOT NULL DEFAULT 0,  -- last_seen - started
  country   TEXT NOT NULL DEFAULT '',
  region    TEXT NOT NULL DEFAULT '',
  city      TEXT NOT NULL DEFAULT '',
  referrer  TEXT NOT NULL DEFAULT '',
  ua        TEXT NOT NULL DEFAULT '',
  views     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pageviews (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  sid  TEXT NOT NULL,
  path TEXT NOT NULL,
  ts   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pageviews_ts   ON pageviews (ts);
CREATE INDEX IF NOT EXISTS idx_pageviews_path ON pageviews (path);
CREATE INDEX IF NOT EXISTS idx_sessions_start ON sessions (started);
