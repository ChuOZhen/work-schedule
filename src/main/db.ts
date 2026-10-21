import { app } from 'electron'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

let db: DatabaseSync | null = null

const SCHEMA_VERSION = 1

const SCHEMA = `
CREATE TABLE IF NOT EXISTS categories (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL,
  sort       INTEGER NOT NULL DEFAULT 0,
  is_builtin INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS events (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  notes       TEXT,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  color       TEXT,
  start_utc   TEXT NOT NULL,
  end_utc     TEXT NOT NULL,
  all_day     INTEGER NOT NULL DEFAULT 0,
  rrule       TEXT,
  rrule_until TEXT,
  lead_min    INTEGER,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_utc);
CREATE INDEX IF NOT EXISTS idx_events_rrule ON events(rrule);

CREATE TABLE IF NOT EXISTS event_exceptions (
  id                   TEXT PRIMARY KEY,
  event_id             TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  occurrence_start_utc TEXT NOT NULL,
  kind                 TEXT NOT NULL,            -- cancelled | override
  override_start_utc   TEXT,
  override_end_utc     TEXT,
  override_title       TEXT,
  override_notes       TEXT,
  override_category_id TEXT,
  override_color       TEXT,
  UNIQUE(event_id, occurrence_start_utc)
);
CREATE INDEX IF NOT EXISTS idx_exceptions_event ON event_exceptions(event_id);

CREATE TABLE IF NOT EXISTS occurrence_state (
  event_id             TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  occurrence_start_utc TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'pending',
  reminded_at          TEXT,
  snooze_until         TEXT,
  PRIMARY KEY (event_id, occurrence_start_utc)
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);
`

const DEFAULT_CATEGORIES: Array<{ id: string; name: string; color: string; sort: number }> = [
  { id: 'cat-meeting', name: '会议', color: '#0A84FF', sort: 1 },
  { id: 'cat-focus', name: '专注', color: '#30D158', sort: 2 },
  { id: 'cat-chore', name: '事务', color: '#FF9F0A', sort: 3 },
  { id: 'cat-personal', name: '个人', color: '#BF5AF2', sort: 4 },
  { id: 'cat-other', name: '其他', color: '#8E8E93', sort: 5 }
]

export const DEFAULT_SETTINGS = {
  defaultLeadMinutes: 10,
  autoLaunch: true,
  reduceTransparency: false,
  mutedUntil: null as string | null,
  closeHintShown: false
}

export function dbFilePath(): string {
  return join(app.getPath('userData'), 'data.db')
}

export function initDb(): DatabaseSync {
  if (db) return db
  const file = dbFilePath()
  mkdirSync(dirname(file), { recursive: true })
  db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL;')
  db.exec('PRAGMA foreign_keys = ON;')
  db.exec(SCHEMA)

  const row = db.prepare('SELECT MAX(version) AS v FROM schema_migrations').get() as { v: number | null } | undefined
  if (!row || row.v === null) {
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
      SCHEMA_VERSION,
      new Date().toISOString()
    )
  }

  seed(db)
  return db
}

function seed(conn: DatabaseSync): void {
  const count = conn.prepare('SELECT COUNT(*) AS c FROM categories').get() as { c: number }
  if (Number(count.c) === 0) {
    const ins = conn.prepare(
      'INSERT INTO categories (id, name, color, sort, is_builtin) VALUES (?, ?, ?, ?, 1)'
    )
    for (const c of DEFAULT_CATEGORIES) ins.run(c.id, c.name, c.color, c.sort)
  }
  const insSetting = conn.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insSetting.run(k, JSON.stringify(v))
}

export function conn(): DatabaseSync {
  if (!db) return initDb()
  return db
}

export function closeDb(): void {
  try {
    db?.close()
  } catch {
    /* ignore */
  }
  db = null
}
