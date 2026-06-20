import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDb, closeDb } from '../src/db/index.ts';
import { loadConfig } from '../src/config.ts';
import { initBlobs } from '../src/files/blobs.ts';

// Each test file gets a fresh in-memory DB and a throwaway temp blob dir.
// Integration tests call core/ directly — no HTTP server, no sleep(1).

let tempDir: string;

export function setupDb(): void {
  tempDir = mkdtempSync(join(tmpdir(), 'tavern-test-'));
  // loadConfig must run before initBlobs (which reads config.dataDir). Point
  // it at the temp dir via the env var override.
  process.env['TAVERN_DATA_DIR'] = tempDir;
  loadConfig([]);
  openDb(':memory:');
  initBlobs();
}

export function teardownDb(): void {
  closeDb();
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  delete process.env['TAVERN_DATA_DIR'];
}

export const FIXTURES = join(import.meta.dirname, 'fixtures');

