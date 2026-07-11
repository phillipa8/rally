// db.js — opens the SQLite database (better-sqlite3) and ensures the schema exists.
// Exports a single shared connection used across the app.
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = process.env.DATABASE_PATH || path.join(import.meta.dirname, 'app.db');

const db = new Database(dbPath);

// WAL = better concurrent reads. foreign_keys must be set per connection.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function hasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((row) => row.name === column);
}

// Pre-migrate older app.db files before schema.sql creates indexes that depend
// on new columns. Fresh databases skip this because the posts table is not there.
if (!hasColumn('posts', 'quoted_post_id')) {
  const postsTableExists = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'posts'")
    .get();
  if (postsTableExists) {
    db.prepare(
      'ALTER TABLE posts ADD COLUMN quoted_post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL'
    ).run();
  }
}

if (!hasColumn('events', 'is_private')) {
  const eventsTableExists = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'events'")
    .get();
  if (eventsTableExists) {
    db.prepare(
      'ALTER TABLE events ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0 CHECK (is_private IN (0,1))'
    ).run();
  }
}

// Apply the schema (idempotent — every statement uses IF NOT EXISTS / OR IGNORE).
const schema = fs.readFileSync(path.join(import.meta.dirname, 'schema.sql'), 'utf8');
db.exec(schema);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_posts_quoted ON posts(quoted_post_id);
`);

export default db;
