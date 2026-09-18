CREATE TABLE IF NOT EXISTS schoology_connections (
  firebase_uid TEXT PRIMARY KEY,
  encrypted_calendar_url TEXT NOT NULL,
  connected_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS completed_assignments (
  firebase_uid TEXT NOT NULL,
  assignment_id TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  PRIMARY KEY (firebase_uid, assignment_id)
);

CREATE INDEX IF NOT EXISTS idx_completed_user
ON completed_assignments(firebase_uid);
