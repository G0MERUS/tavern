import express, { type Express } from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Server } from 'node:http';

import { Elysia, mountElysia, type Ctx } from './_compat/elysia.ts';
import { getConfig, requiresAuth } from './config.ts';
import { blobDir } from './files/blobs.ts';
import { AppError } from './types.ts';

import { healthRoutes } from './routes/health.ts';
import { settingsRoutes } from './routes/settings.ts';
import { connectionRoutes, catalogRoute } from './routes/connections.ts';
import { presetRoutes } from './routes/presets.ts';
import { themeRoutes } from './routes/themes.ts';
import { personaRoutes } from './routes/personas.ts';
import { characterRoutes } from './routes/characters.ts';
import { chatRoutes } from './routes/chats.ts';
import { messageRoutes } from './routes/messages.ts';
import { lorebookRoutes } from './routes/lorebooks.ts';
import { generateRoutes } from './routes/generate.ts';
import { fileRoutes } from './routes/files.ts';

// Server assembly. The route files are written against a small Elysia-shaped
// shim (src/_compat/elysia.ts); here we collect them all under one tree and
// mount that onto an Express app, then bolt on the cross-cutting concerns
// (CORS, bearer auth, static blobs, SPA fallback) that Elysia plugins used to
// provide.

export interface ServerHandle {
  listen(
    opts: { port: number; hostname: string },
    cb: (info: { hostname: string; port: number }) => void,
  ): ServerHandle;
  stop(): void;
}

const IMMUTABLE = { maxAge: '1y', immutable: true } as const;

export function buildServer(): ServerHandle {
  const config = getConfig();
  const authRequired = requiresAuth();
  const distDir = join(process.cwd(), 'dist');
  const hasFrontend = existsSync(distDir);

  const app: Express = express();

  // CORS only matters when publicly reachable. Mirrors the old conditional.
  app.use(cors({ origin: authRequired ? true : false }));

  // Body parsing. Multipart routes use multer (in the shim); these cover the
  // JSON/urlencoded bodies. `limit` is generous for big lorebook imports.
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Bearer auth gate — applied as a global beforeHandle inside mountElysia so
  // it only guards routed (API) handlers, not static assets.
  const authGate = ({ bearer, status }: Ctx) => {
    if (!authRequired) return;
    if (bearer !== config.apiToken) {
      return status(401, {
        error: { code: 'UNAUTHORIZED', message: 'Invalid bearer token' },
      });
    }
  };

  // /health and /api/catalog were public in the original (no bearer); keep
  // them on a tree without the auth gate.
  const publicTree = new Elysia()
    .use(healthRoutes)
    .use(catalogRoute);

  const apiTree = new Elysia()
    .use(settingsRoutes)
    .use(connectionRoutes)
    .use(presetRoutes)
    .use(themeRoutes)
    .use(personaRoutes)
    .use(characterRoutes)
    .use(chatRoutes)
    .use(messageRoutes)
    .use(lorebookRoutes)
    .use(generateRoutes)
    .use(fileRoutes)
    .onError(errorHandler);

  mountElysia(app, publicTree);
  mountElysia(app, apiTree, [authGate]);

  // Blob filenames are nanoids, so content is effectively immutable.
  app.use('/blobs/avatars', express.static(blobDir('avatars'), IMMUTABLE));
  app.use('/blobs/backgrounds', express.static(blobDir('backgrounds'), IMMUTABLE));
  app.use('/blobs/attachments', express.static(blobDir('attachments'), IMMUTABLE));

  // Frontend: serve built assets immutably; fall back to index.html for any
  // non-API/non-blob GET so the Vite SPA router handles client routes.
  if (hasFrontend) {
    app.use('/assets', express.static(join(distDir, 'assets'), IMMUTABLE));
    const indexHtml = join(distDir, 'index.html');
    app.get('*', (req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/') || req.path.startsWith('/blobs/')) {
        return next();
      }
      res.set('Cache-Control', 'no-cache').sendFile(indexHtml);
    });
  } else {
    app.get('/', (_req, res) => {
      res.json({ message: 'Tavern API running. Frontend not built.' });
    });
  }

  // Final 404 for anything unmatched (real API/blob misses).
  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  // Wrap node's http.Server in the listen/stop handle index.ts expects.
  let server: Server | undefined;
  const handle: ServerHandle = {
    listen({ port, hostname }, cb) {
      server = app.listen(port, hostname, () => cb({ hostname, port }));
      return handle;
    },
    stop() {
      server?.close();
    },
  };
  return handle;
}

// AppError carries a stable code + status. Everything else is a real bug.
const errorHandler = ({
  error,
  set,
}: {
  error: unknown;
  set: { status: number; headers: Record<string, string> };
}) => {
  if (error instanceof AppError) {
    set.status = error.status;
    return {
      error: { code: error.code, message: error.message, ...(error.details as object) },
    };
  }
  console.error('✗', error);
  set.status = 500;
  return { error: { code: 'INTERNAL', message: 'Internal server error' } };
};

export type App = ServerHandle;
