import { join } from 'node:path';
import { loadConfig, requiresAuth } from './config.ts';
import { openDb, closeDb } from './db/index.ts';
import { seed } from './db/seed.ts';
import { initBlobs } from './files/blobs.ts';
import { buildServer } from './server.ts';

const config = loadConfig();

const dbPath = join(config.dataDir, 'tavern.db');
openDb(dbPath);
seed();
initBlobs();

const app = buildServer();

app.listen({ port: config.port, hostname: config.host }, (server) => {
  const auth = requiresAuth() ? '🔒 bearer auth' : '🔓 no auth (localhost)';
  console.log(`✓ tavern listening on http://${server.hostname}:${server.port}`);
  console.log(`  ${auth} · db: ${dbPath} · docs: /docs`);
});

// Graceful shutdown lets SQLite checkpoint the WAL.
const shutdown = (sig: string) => {
  console.log(`\n${sig} — shutting down`);
  app.stop();
  closeDb();
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
