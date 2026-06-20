import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { setupDb, teardownDb, FIXTURES } from '../setup.ts';
import { createPreset, getPreset, updatePreset } from '../../src/core/presets.ts';
import { createConnection, activateConnection } from '../../src/core/connections.ts';
import { setSetting } from '../../src/core/settings.ts';

// Lucid Loom is a 445KB real-world preset with 326 prompts, regex scripts,
// and every sampling param under the sun. If we can store this and
// roundtrip it through JSON columns without loss, the preset system works.

const lucidLoom = JSON.parse(
  readFileSync(join(FIXTURES, 'lucid-loom.json'), 'utf8'),
);

beforeEach(setupDb);
afterEach(teardownDb);

describe('preset storage — Lucid Loom (445KB real-world preset)', () => {
  test('stores and retrieves the full blob losslessly', () => {
    // params is a JSON column — we don't validate. The upstream API does on POST.
    const created = createPreset('Lucid Loom v3.4', lucidLoom);

    const retrieved = getPreset(created.id)!;
    const params = JSON.parse(retrieved.params);

    expect(params.temperature).toBe(1);
    expect(params.top_p).toBe(0.97);
    expect(params.openai_max_tokens).toBe(32768);
    expect(params.openai_max_context).toBe(200000);
    expect(params.prompts).toHaveLength(326);
    expect(params.extensions.regex_scripts).toBeDefined();

    // Hard equality on the entire structure — JSON column roundtrip must be
    // byte-perfect or import → export breaks.
    expect(params).toEqual(lucidLoom);
  });

  test('extracted sampling params are what generate.ts would actually use', () => {
    // In practice the frontend extracts sampling params and stores just those.
    const sampling = {
      temperature: lucidLoom.temperature,
      top_p: lucidLoom.top_p,
      top_k: lucidLoom.top_k,
      min_p: lucidLoom.min_p,
      frequency_penalty: lucidLoom.frequency_penalty,
      presence_penalty: lucidLoom.presence_penalty,
      repetition_penalty: lucidLoom.repetition_penalty,
      max_tokens: lucidLoom.openai_max_tokens,
    };

    const preset = createPreset('Lucid Sampling', sampling);
    const params = JSON.parse(getPreset(preset.id)!.params);

    expect(params).toEqual(sampling);
    expect(params.temperature).toBe(1);
    expect(params.top_p).toBe(0.97);
    expect(params.max_tokens).toBe(32768);
  });

  test('updatePreset replaces params atomically', () => {
    const p = createPreset('mut', { temperature: 0.5 });
    updatePreset(p.id, { params: { temperature: 0.9, top_p: 0.95 } });

    const updated = JSON.parse(getPreset(p.id)!.params);
    // Full replace, not merge — documented PATCH behaviour.
    expect(updated).toEqual({ temperature: 0.9, top_p: 0.95 });
  });
});

describe('generate request building', () => {
  test('active connection + preset are resolved from settings', () => {
    const conn = createConnection({
      label: 'Test',
      base_url: 'http://localhost:8080/v1',
      model: 'test-model',
      extra_body: { transforms: ['middle-out'] },
    });
    activateConnection(conn.id);

    const preset = createPreset('Lucid Sampling', {
      temperature: lucidLoom.temperature,
      top_p: lucidLoom.top_p,
      max_tokens: lucidLoom.openai_max_tokens,
    });
    setSetting('active_preset_id', preset.id);

    // The actual fetch + spread is exercised by integration/generate.test.ts
    // with a mock upstream. Here we just verify the wiring.
    const { getActive } = require('../../src/core/connections.ts');
    const { getSetting } = require('../../src/core/settings.ts');
    expect(getActive()!.id).toBe(conn.id);
    expect(getSetting('active_preset_id')).toBe(preset.id);
  });
});
