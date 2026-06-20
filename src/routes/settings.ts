import { Elysia, t } from '../_compat/elysia.ts';

import { getAllSettings, patchSettings } from '../core/settings.ts';

export const settingsRoutes = new Elysia({ prefix: '/api/settings', tags: ['settings'] })
  .get('/', () => getAllSettings())
  .patch(
    '/',
    ({ body }) => {
      patchSettings(body);
      return getAllSettings();
    },
    { body: t.Record(t.String(), t.Unknown()) },
  );
