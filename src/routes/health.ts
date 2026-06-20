import { Elysia } from 'elysia';
import { ping } from '../db/index.ts';

export const healthRoutes = new Elysia()
  .get('/health', () => ({ status: 'ok', db: ping() }));
