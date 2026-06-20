import { Database } from 'bun:sqlite';
import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

// SQLite for single-user local software. Synchronous on purpose: the only
// concurrent writers are the user clicking save and an SSE stream finishing,
// which WAL mode handles.

let db: Database;

export function getDb(): Database {
  if (!db) throw new Error('Database not opened — call openDb() first');
  return db;
}

export function openDb(path: string): Database {
  // :memory: is for tests.
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }

  db = new Database(path, { create: true, strict: true });

  // WAL: concurrent reader during write. NORMAL sync is safe with WAL and
  // noticeably faster than FULL. busy_timeout instead of erroring on
  // contention.
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');

  migrate(db, path);
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = undefined as unknown as Database;
  }
}

// Migrations: numbered .sql files, version tracked in PRAGMA user_version.
// No down-migrations — restore from .backup if you need to roll back. Each
// migration runs in a transaction; if any statement fails, none apply.

const MIGRATIONS_DIR = join(import.meta.dir, 'migrations');

function migrate(db: Database, path: string): void {
  const current = (db.query('PRAGMA user_version').get() as { user_version: number }).user_version;

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+.*\.sql$/.test(f))
    .sort();

  for (const file of files) {
    const version = parseInt(file.match(/^(\d+)/)![1]!, 10);
    if (version <= current) continue;

    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    if (path !== ':memory:') console.log(`→ migration ${file}`);

    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.exec(`PRAGMA user_version = ${version}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
    }
  }
}

/** Run a callback inside a transaction. Returns its return value. Rolls back on throw. */
export function transaction<T>(fn: () => T): T {
  return db.transaction(fn)();
}

/** SELECT 1 — for /health. */
export function ping(): boolean {
  try {
    db.query('SELECT 1').get();
    return true;
  } catch {
    return false;
  }
}
