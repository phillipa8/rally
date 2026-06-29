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

// Apply the schema (idempotent — every statement uses IF NOT EXISTS / OR IGNORE).
const schema = fs.readFileSync(path.join(import.meta.dirname, 'schema.sql'), 'utf8');
db.exec(schema);

export default db;
