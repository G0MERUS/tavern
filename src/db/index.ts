import { DatabaseSync, type StatementSync } from 'node:sqlite';
import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// SQLite for single-user local software. Synchronous on purpose: the only
// concurrent writers are the user clicking save and an SSE stream finishing,
// which WAL mode handles.
//
// This used to use bun:sqlite. We've moved to Node's built-in `node:sqlite`
// (DatabaseSync) so the app runs on stock Node — including Termux — with no
// native compilation step (better-sqlite3 needs a C++ toolchain). `Db` is a
// thin wrapper that keeps the bun:sqlite-style API the rest of the codebase
// already calls: `.query(sql)` → a prepared statement with `.get/.all/.run`,
// `.exec(sql)`, and `.transaction(fn)()`.

// bun:sqlite returned statements typed by the generics passed to `.query()`.
// node:sqlite's StatementSync returns loosely-typed `Record<string,
// SQLOutputValue>`. This typed facade restores the old ergonomics so the core
// layer compiles unchanged: `.get(...p): Row | undefined`, `.all(...p): Row[]`,
// `.run(...p)`. Param values are coerced to node:sqlite's accepted input types.
export interface TypedStatement<Row, Params extends unknown[]> {
  get(...params: Params): Row | undefined;
  all(...params: Params): Row[];
  run(...params: Params): { changes: number | bigint; lastInsertRowid: number | bigint };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyParams = any[];

function wrapStatement<Row, Params extends unknown[]>(
  stmt: StatementSync,
): TypedStatement<Row, Params> {
  return {
    get: (...params: Params) => stmt.get(...(params as AnyParams)) as Row | undefined,
    all: (...params: Params) => stmt.all(...(params as AnyParams)) as Row[],
    run: (...params: Params) => stmt.run(...(params as AnyParams)),
  };
}

class Db {
  constructor(public raw: DatabaseSync) {}

  /**
   * bun:sqlite's `.query<Row, Params>()` ≈ node:sqlite's `.prepare()`, wrapped
   * to carry the row/param types through `.get/.all/.run`.
   */
  query<Row = unknown, Params extends unknown[] = unknown[]>(
    sql: string,
  ): TypedStatement<Row, Params> {
    return wrapStatement<Row, Params>(this.raw.prepare(sql));
  }


  exec(sql: string): void {
    this.raw.exec(sql);
  }

  /**
   * better-sqlite3/bun expose `transaction(fn)` returning a callable that runs
   * fn inside BEGIN/COMMIT (ROLLBACK on throw). node:sqlite has no built-in, so
   * we wrap manually. Not reentrant — fine for our usage.
   */
  transaction<T>(fn: (...args: unknown[]) => T): (...args: unknown[]) => T {
    return (...args: unknown[]): T => {
      this.raw.exec('BEGIN');
      try {
        const result = fn(...args);
        this.raw.exec('COMMIT');
        return result;
      } catch (err) {
        this.raw.exec('ROLLBACK');
        throw err;
      }
    };
  }

  close(): void {
    this.raw.close();
  }
}

export type Database = Db;

let db: Db;

export function getDb(): Db {
  if (!db) throw new Error('Database not opened — call openDb() first');
  return db;
}

export function openDb(path: string): Db {
  // :memory: is for tests.
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }

  db = new Db(new DatabaseSync(path));

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
    db = undefined as unknown as Db;
  }
}

// Migrations: numbered .sql files, version tracked in PRAGMA user_version.
// No down-migrations — restore from .backup if you need to roll back. Each
// migration runs in a transaction; if any statement fails, none apply.

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

function migrate(db: Db, path: string): void {
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
