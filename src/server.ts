import { Elysia } from 'elysia';
import { staticPlugin } from '@elysiajs/static';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { bearer } from '@elysiajs/bearer';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

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

/**
 * Assemble the Elysia server. Built as a single fluent chain — Elysia's
 * structural typing doesn't tolerate conditional `app = app.use(...)`
 * reassignment without the types diverging.
 */
export function buildServer() {
  const config = getConfig();
  const authRequired = requiresAuth();
  const distDir = join(process.cwd(), 'dist');
  const hasFrontend = existsSync(distDir);

  // Bearer-gated when listening publicly.
  const api = new Elysia()
    .use(bearer())
    .onBeforeHandle(({ bearer: token, status, path }) => {
      if (!authRequired) return;
      if (!path.startsWith('/api')) return;
      if (token !== config.apiToken) {
        return status(401, {
          error: { code: 'UNAUTHORIZED', message: 'Invalid bearer token' },
        });
      }
    })
    .use(settingsRoutes)
    .use(catalogRoute)
    .use(connectionRoutes)
    .use(presetRoutes)
    .use(themeRoutes)
    .use(personaRoutes)
    .use(characterRoutes)
    .use(chatRoutes)
    .use(messageRoutes)
    .use(lorebookRoutes)

    .use(generateRoutes)
    .use(fileRoutes);

  // Blob filenames are nanoids, so content is effectively immutable.
  const blobs = new Elysia()
    .use(
      staticPlugin({
        assets: blobDir('avatars'),
        prefix: '/blobs/avatars',
        alwaysStatic: false,
        headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
      }),
    )
    .use(
      staticPlugin({
        assets: blobDir('backgrounds'),
        prefix: '/blobs/backgrounds',
        alwaysStatic: false,
        headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
      }),
    )
    .use(
      staticPlugin({
        assets: blobDir('attachments'),
        prefix: '/blobs/attachments',
        alwaysStatic: false,
        headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
      }),
    );

  // Two Elysia gotchas force the unusual shape here:
  //   1. Don't let @elysiajs/static touch index.html. Bun 1.x's HTML loader
  //      treats <script src=...> as a module graph (built for `bun build`,
  //      not for serving a pre-built Vite bundle); the plugin's indexHTML
  //      mode trips it. Mount /assets only — no .html files inside.
  //   2. Don't use .get('/*') as the SPA fallback. Elysia merges all routes
  //      into one radix tree regardless of .use() order, so a /* wildcard
  //      shadows /api/health. Serve index.html from the NOT_FOUND error
  //      path instead — only fires when nothing else matched.
  const indexHtml = hasFrontend ? Bun.file(join(distDir, 'index.html')) : null;
  const frontend = hasFrontend
    ? new Elysia().use(
        staticPlugin({
          assets: join(distDir, 'assets'),
          prefix: '/assets',
          alwaysStatic: false,
          headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
        }),
      )
    : new Elysia().get('/', () => ({
        message: 'Tavern API running. Frontend not built — see /docs for API.',
      }));

  return new Elysia()
    // AppError carries a stable code + status. Validation errors get a useful
    // field path. Everything else is a real bug — log + 500.
    .onError(({ error, code, set, request, path }) => {
      if (error instanceof AppError) {
        set.status = error.status;
        return {
          error: { code: error.code, message: error.message, ...(error.details as object) },
        };
      }
      if (code === 'VALIDATION') {
        set.status = 400;
        return { error: { code: 'VALIDATION', message: String(error) } };
      }
      if (code === 'NOT_FOUND') {
        // SPA fallback. /api and /blobs misses are real 404s; anything else
        // is a frontend route for the Vite router to handle.
        if (
          indexHtml &&
          request.method === 'GET' &&
          !path.startsWith('/api/') &&
          !path.startsWith('/blobs/')
        ) {
          set.status = 200;
          return new Response(indexHtml, {
            headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' },
          });
        }
        set.status = 404;
        return { error: { code: 'NOT_FOUND', message: 'Route not found' } };
      }
      console.error('✗', error);
      set.status = 500;
      return { error: { code: 'INTERNAL', message: 'Internal server error' } };
    })
    .use(healthRoutes)
    // CORS only matters when we're publicly reachable, but mounting it
    // conditionally breaks the chain typing, so always mount.
    .use(cors({ origin: authRequired ? true : false }))
    .use(
      swagger({
        path: '/docs',
        documentation: {
          info: { title: 'Tavern API', version: '0.1.0' },
          tags: [
            { name: 'characters' }, { name: 'chats' }, { name: 'messages' },
            { name: 'lorebooks' }, { name: 'personas' },
            { name: 'connections' }, { name: 'presets' }, { name: 'settings' },
            { name: 'generation' }, { name: 'files' },
          ],
        },

      }),
    )
    .use(api)
    .use(blobs)
    .use(frontend);
}

export type App = ReturnType<typeof buildServer>;
