import { nanoid } from 'nanoid';
import { getDb, transaction } from './index.ts';

/** First-boot inserts. Idempotent: only writes if the relevant table is empty. */
export function seed(): void {
  const db = getDb();

  transaction(() => {
    // Default persona.
    const personaCount = db
      .query<{ n: number }, []>('SELECT COUNT(*) AS n FROM personas')
      .get()!.n;

    let personaId: string;
    if (personaCount === 0) {
      personaId = nanoid(12);
      db.query(
        `INSERT INTO personas (id, name, description, is_default) VALUES (?, ?, ?, 1)`,
      ).run(personaId, 'User', '');
    } else {
      personaId =
        db
          .query<{ id: string }, []>(
            'SELECT id FROM personas WHERE is_default = 1 LIMIT 1',
          )
          .get()?.id ??
        db.query<{ id: string }, []>('SELECT id FROM personas LIMIT 1').get()!.id;
    }

    // Default preset.
    const presetCount = db
      .query<{ n: number }, []>('SELECT COUNT(*) AS n FROM presets')
      .get()!.n;

    let presetId: string;
    if (presetCount === 0) {
      presetId = nanoid(12);
      db.query(`INSERT INTO presets (id, name, params) VALUES (?, ?, ?)`).run(
        presetId,
        'Default',
        JSON.stringify({ temperature: 0.7, max_tokens: 2048 }),
      );
    } else {
      presetId = db
        .query<{ id: string }, []>('SELECT id FROM presets ORDER BY created_at LIMIT 1')
        .get()!.id;
    }

    // Default settings.
    const upsert = db.query(
      `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING`,
    );
    upsert.run('active_persona_id', JSON.stringify(personaId));
    upsert.run('active_preset_id', JSON.stringify(presetId));
    upsert.run('active_connection_id', JSON.stringify(null));
    upsert.run('context_size', JSON.stringify(8192));
    upsert.run('system_prompt_template', JSON.stringify(''));
  });
}
