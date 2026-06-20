// ─────────────────────────────────────────────────────────────────────────────
// Preset compat migration + defaults. The lucid-loom fixture is a real ST
// preset (445KB, 326 prompts) — if the migrator handles that, it handles
// anything.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { migrateSTPreset, isSTPreset } from '$lib/compat/preset';
import {
  DEFAULT_PROMPTS,
  DEFAULT_ORDER,
  DEFAULT_SAMPLERS,
  RESERVED_IDS,
  makeDefaultPreset,
  canDelete,
  canEdit,
  canDetach,
  canForbidOverride,
  canReset,
} from '$lib/core/preset-defaults';
import { samplersToWire } from '$lib/core/sampler-wire';

const lucidLoom = JSON.parse(
  readFileSync(resolve(__dirname, '../../../tests/fixtures/lucid-loom.json'), 'utf-8'),
);

// ── Detection ────────────────────────────────────────────────────────────────

describe('isSTPreset', () => {
  test('recognizes lucid-loom', () => {
    expect(isSTPreset(lucidLoom)).toBe(true);
  });

  test('rejects character cards', () => {
    expect(isSTPreset({ spec: 'chara_card_v2', data: { first_mes: 'hi' } })).toBe(false);
  });

  test('rejects lorebooks', () => {
    expect(isSTPreset({ entries: [] })).toBe(false);
  });

  test('rejects null/primitives', () => {
    expect(isSTPreset(null)).toBe(false);
    expect(isSTPreset('hi')).toBe(false);
    expect(isSTPreset(42)).toBe(false);
  });
});

// ── Migration: samplers ──────────────────────────────────────────────────────

describe('migrateSTPreset: samplers', () => {
  const migrated = migrateSTPreset(lucidLoom);

  test('lifts openai_max_context', () => {
    expect(migrated.samplers.openai_max_context).toBe(200000);
  });

  test('lifts bare temperature (no _openai suffix)', () => {
    // lucid-loom uses bare `temperature: 1`, no `temp_openai`.
    expect(migrated.samplers.temperature).toBe(1);
  });

  test('lifts top_p', () => {
    expect(migrated.samplers.top_p).toBe(0.97);
  });

  test('renames stream_openai → stream', () => {
    expect(migrated.samplers.stream).toBe(true);
  });

  test('falls back to defaults for missing keys', () => {
    const empty = migrateSTPreset({ prompts: [], openai_max_context: 8000 });
    expect(empty.samplers.temperature).toBe(1.0);
    expect(empty.samplers.seed).toBe(-1);
  });
});

// ── Migration: prompts ───────────────────────────────────────────────────────

describe('migrateSTPreset: prompts', () => {
  const migrated = migrateSTPreset(lucidLoom);

  test('preserves all 326 prompts', () => {
    expect(migrated.prompts.length).toBe(326);
  });

  test('normalizes prompt fields', () => {
    for (const p of migrated.prompts) {
      expect(typeof p.identifier).toBe('string');
      expect(['system', 'user', 'assistant']).toContain(p.role);
      expect(p.injection_position === 0 || p.injection_position === 1).toBe(true);
      expect(typeof p.injection_depth).toBe('number');
      expect(Array.isArray(p.injection_trigger)).toBe(true);
    }
  });

  test('preserves system prompt markers', () => {
    const main = migrated.prompts.find((p) => p.identifier === 'main');
    expect(main?.system_prompt).toBe(true);
    expect(main?.marker).toBe(false);
  });

  test('preserves marker flags', () => {
    const chatHistory = migrated.prompts.find((p) => p.identifier === 'chatHistory');
    expect(chatHistory?.marker).toBe(true);
  });

  test('legacy main_prompt → pool', () => {
    const out = migrateSTPreset({
      prompts: [],
      openai_max_context: 8000,
      main_prompt: 'LEGACY MAIN',
    });
    const main = out.prompts.find((p) => p.identifier === 'main');
    expect(main?.content).toBe('LEGACY MAIN');
  });

  test('legacy main_prompt does not clobber existing pool entry', () => {
    const out = migrateSTPreset({
      prompts: [{ identifier: 'main', name: 'Main', content: 'POOL MAIN', system_prompt: true }],
      openai_max_context: 8000,
      main_prompt: 'LEGACY MAIN',
    });
    const main = out.prompts.find((p) => p.identifier === 'main');
    expect(main?.content).toBe('POOL MAIN');
  });
});

// ── Migration: order ─────────────────────────────────────────────────────────

describe('migrateSTPreset: prompt_order', () => {
  const migrated = migrateSTPreset(lucidLoom);

  test('renumbers picked bucket to 100000', () => {
    expect(migrated.prompt_order.length).toBe(1);
    expect(migrated.prompt_order[0]?.character_id).toBe(100000);
  });

  test('picks the largest bucket, not the literal 100000 stub', () => {
    // lucid-loom: 100000 is an 11-entry default-order stub; 100001 has
    // the 326-entry arrangement the user actually built. The stub at
    // 100000 is what ST writes BEFORE you've touched the order.
    expect(migrated.prompt_order[0]?.order.length).toBe(326);
  });

  test('picked bucket includes user-defined prompts (proves we got 100001)', () => {
    // The 11-entry stub only references reserved markers. If we picked it
    // by mistake, no UUIDs would appear in the order.
    const ids = migrated.prompt_order[0]!.order.map((e) => e.identifier);
    const uuids = ids.filter((id) => id.includes('-'));
    expect(uuids.length).toBeGreaterThan(300);
  });

  test('order entries have identifier + enabled', () => {
    for (const e of migrated.prompt_order[0]!.order) {
      expect(typeof e.identifier).toBe('string');
      expect(typeof e.enabled).toBe('boolean');
    }
  });

  test('falls back to whatever bucket exists when only one', () => {
    const out = migrateSTPreset({
      prompts: [],
      openai_max_context: 8000,
      prompt_order: [
        { character_id: 5, order: [{ identifier: 'main', enabled: true }] },
      ],
    });
    expect(out.prompt_order[0]?.character_id).toBe(100000);
    expect(out.prompt_order[0]?.order[0]?.identifier).toBe('main');
  });

  test('size tiebreak: largest wins', () => {
    const out = migrateSTPreset({
      prompts: [],
      openai_max_context: 8000,
      prompt_order: [
        { character_id: 100000, order: [{ identifier: 'main', enabled: true }] },
        { character_id: 7, order: [
          { identifier: 'main', enabled: true },
          { identifier: 'jailbreak', enabled: true },
          { identifier: 'custom', enabled: false },
        ] },
      ],
    });
    expect(out.prompt_order[0]?.order.length).toBe(3);
  });
});

// ── Migration: behavior ──────────────────────────────────────────────────────

describe('migrateSTPreset: behavior', () => {
  test('continue_postfix string → enum', () => {
    // lucid-loom stores ' ' (space string).
    const migrated = migrateSTPreset(lucidLoom);
    expect(migrated.behavior.continue_postfix).toBe(1);
  });

  test('continue_postfix newline variants', () => {
    expect(migrateSTPreset({ prompts: [], openai_max_context: 1, continue_postfix: '' }).behavior.continue_postfix).toBe(0);
    expect(migrateSTPreset({ prompts: [], openai_max_context: 1, continue_postfix: '\n' }).behavior.continue_postfix).toBe(2);
    expect(migrateSTPreset({ prompts: [], openai_max_context: 1, continue_postfix: '\n\n' }).behavior.continue_postfix).toBe(3);
  });

  test('media_inlining → image_inlining', () => {
    const migrated = migrateSTPreset(lucidLoom);
    expect(migrated.behavior.image_inlining).toBe(false);  // lucid-loom: media_inlining: false
  });

  test('strips _tools suffix from post_processing', () => {
    const out = migrateSTPreset({
      prompts: [], openai_max_context: 1,
      custom_prompt_post_processing: 'merge_tools',
    });
    expect(out.behavior.custom_prompt_post_processing).toBe('merge');
  });

  test('names_behavior preserved as number', () => {
    const migrated = migrateSTPreset(lucidLoom);
    expect(migrated.behavior.names_behavior).toBe(0);
  });
});

// ── Defaults ─────────────────────────────────────────────────────────────────

describe('preset-defaults', () => {
  test('DEFAULT_PROMPTS has all 12 reserved identifiers', () => {
    const ids = new Set(DEFAULT_PROMPTS.map((p) => p.identifier));
    for (const id of RESERVED_IDS) {
      expect(ids.has(id)).toBe(true);
    }
    expect(DEFAULT_PROMPTS.length).toBe(12);
  });

  test('DEFAULT_ORDER references only reserved ids', () => {
    for (const e of DEFAULT_ORDER) {
      expect(RESERVED_IDS.has(e.identifier)).toBe(true);
    }
  });

  test('enhanceDefinitions starts disabled', () => {
    const e = DEFAULT_ORDER.find((o) => o.identifier === 'enhanceDefinitions');
    expect(e?.enabled).toBe(false);
  });

  test('makeDefaultPreset is self-contained', () => {
    const a = makeDefaultPreset();
    const b = makeDefaultPreset();
    a.samplers.temperature = 99;
    a.prompts[0]!.content = 'mutated';
    expect(b.samplers.temperature).toBe(1.0);
    expect(b.prompts[0]!.content).not.toBe('mutated');
  });
});

// ── Permission predicates ────────────────────────────────────────────────────

describe('permission predicates', () => {
  const main = DEFAULT_PROMPTS.find((p) => p.identifier === 'main')!;
  const chatHistory = DEFAULT_PROMPTS.find((p) => p.identifier === 'chatHistory')!;
  const charDesc = DEFAULT_PROMPTS.find((p) => p.identifier === 'charDescription')!;
  const userPrompt = { ...main, identifier: 'custom', system_prompt: false, marker: false };

  test('canDelete: system prompts no, user prompts yes', () => {
    expect(canDelete(main)).toBe(false);
    expect(canDelete(chatHistory)).toBe(false);
    expect(canDelete(userPrompt)).toBe(true);
  });

  test('canEdit: most markers no, but PROMPT_SOURCES markers yes', () => {
    expect(canEdit(main)).toBe(true);
    expect(canEdit(chatHistory)).toBe(false);  // marker not in PROMPT_SOURCES
    expect(canEdit(charDesc)).toBe(true);      // marker IN PROMPT_SOURCES
    expect(canEdit(userPrompt)).toBe(true);
  });

  test('canDetach mirrors canDelete', () => {
    expect(canDetach(main)).toBe(false);
    expect(canDetach(userPrompt)).toBe(true);
  });

  test('canForbidOverride: only main and jailbreak', () => {
    expect(canForbidOverride(main)).toBe(true);
    expect(canForbidOverride(DEFAULT_PROMPTS.find((p) => p.identifier === 'jailbreak')!)).toBe(true);
    expect(canForbidOverride(charDesc)).toBe(false);
    expect(canForbidOverride(userPrompt)).toBe(false);
  });

  test('canReset: editable system prompts only', () => {
    expect(canReset(main)).toBe(true);
    expect(canReset(chatHistory)).toBe(false);  // marker
    expect(canReset(userPrompt)).toBe(false);   // not system
  });
});

// ── Sampler wire mapping ─────────────────────────────────────────────────────
// Default = absent. Touched sliders go on the wire; untouched ones don't.
// No per-provider vocab to maintain or get wrong.

describe('samplersToWire', () => {
  test('all-defaults → only max_tokens', () => {
    // Untouched preset. The wire payload is the smallest possible:
    // just the response cap. Can't 400 on a key that isn't there.
    const out = samplersToWire(DEFAULT_SAMPLERS);
    expect(out).toEqual({ max_tokens: 4096 });
  });

  test('moved sliders go on the wire, untouched ones do not', () => {
    const out = samplersToWire({
      ...DEFAULT_SAMPLERS,
      temperature: 0.8,
      top_k: 40,
      seed: 42,
      // top_p, min_p, freq_pen, etc all still default → absent
    });
    expect(out).toEqual({
      max_tokens: 4096,
      temperature: 0.8,
      top_k: 40,
      seed: 42,
    });
  });

  test('off-sentinels are the defaults, so they vanish', () => {
    // The old approach hardcoded "top_k=0 means off, drop it". The new
    // approach: 0 is the default, defaults are dropped. Same outcome,
    // less code, no special cases.
    const out = samplersToWire(DEFAULT_SAMPLERS);
    expect(out).not.toHaveProperty('top_k');               // 0
    expect(out).not.toHaveProperty('seed');                // -1
    expect(out).not.toHaveProperty('repetition_penalty');  // 1
    expect(out).not.toHaveProperty('n');                   // 1
    expect(out).not.toHaveProperty('frequency_penalty');   // 0
  });

  test('temperature=1 / top_p=1 also vanish', () => {
    // The o1 case: model rejects temperature entirely. If you didn't
    // touch the slider, you don't trip the rejection.
    const out = samplersToWire(DEFAULT_SAMPLERS);
    expect(out).not.toHaveProperty('temperature');
    expect(out).not.toHaveProperty('top_p');
  });

  test('explicitly setting a value to its default still omits it', () => {
    // Move temp to 0.8, then back to 1.0. Indistinguishable from never
    // having moved it. That's correct: 1.0 → omit → model uses 1.0.
    // To force-send 1.0, use 0.99. You won't need to.
    const out = samplersToWire({ ...DEFAULT_SAMPLERS, temperature: 1.0 });
    expect(out).not.toHaveProperty('temperature');
  });

  test('max_tokens always sent (it is a cap, not a sampler)', () => {
    // Anthropic native requires it. OAI defaults to a small value.
    // The semantic of "don't send" ≠ "unlimited".
    expect(samplersToWire(DEFAULT_SAMPLERS)['max_tokens']).toBe(4096);
    expect(samplersToWire({ ...DEFAULT_SAMPLERS, openai_max_tokens: 32768 })['max_tokens']).toBe(32768);
  });

  test('never leaks frontend-only fields', () => {
    const out = samplersToWire({
      ...DEFAULT_SAMPLERS,
      temperature: 0.5,  // something to make sure we're not just empty
    });
    expect(out).not.toHaveProperty('openai_max_context');   // budget hint
    expect(out).not.toHaveProperty('openai_max_tokens');    // renamed
    expect(out).not.toHaveProperty('max_context_unlocked'); // UI affordance
    expect(out).not.toHaveProperty('stream');               // envelope
    expect(out).not.toHaveProperty('samplers');             // not nested
  });
});
