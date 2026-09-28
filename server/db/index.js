import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { schemaSql } from './schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'restaurant.db');
export const db = new DatabaseSync(dbPath);

// Enable high-performance WAL mode and strict foreign key integrity
try {
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');
} catch (err) {
  console.warn('[DB] Pragma initialization warning:', err.message);
}

// Initialize tables and indexes
try {
  db.exec(schemaSql);
} catch (err) {
  console.error('[DB] Schema initialization error:', err);
}

export function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.all(...params);
}

export function queryOne(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.get(...params);
}

export function execute(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.run(...params);
}

export function withTransaction(fn) {
  db.exec('BEGIN IMMEDIATE;');
  try {
    const result = fn();
    db.exec('COMMIT;');
    return result;
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}
