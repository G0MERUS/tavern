import { Elysia } from '../_compat/elysia.ts';

import { ping } from '../db/index.ts';

export const healthRoutes = new Elysia()
  .get('/health', () => ({ status: 'ok', db: ping() }));
