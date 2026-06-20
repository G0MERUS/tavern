// ─────────────────────────────────────────────────────────────────────────────
// Lorebook scan. The crown jewel — keyword-triggered context injection with
// recursion, mutual exclusion, budget enforcement. The original is ~1500 LOC
// of algorithm wrapped in ~3200 LOC of jQuery. We test the algorithm.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, test, expect } from 'vitest';
import { scanLorebook, type ScanEntry, type ScanOptions } from '$lib/core/worldinfo-scan';

const entry = (over: Partial<ScanEntry> = {}): ScanEntry => ({
  id: over.id ?? 'e1',
  keys: [],
  secondary_keys: [],
  content: 'CONTENT',
  enabled: true,
  constant: false,
  selective: true,
  selectiveLogic: 0,
  case_sensitive: false,
  match_whole_words: false,
  position: 'before_char',
  depth: null,
  insertion_order: 100,
  probability: 100,
  ignoreBudget: false,
  excludeRecursion: false,
  preventRecursion: false,
  delayUntilRecursion: 0,
  group: '',
  groupOverride: false,
  groupWeight: 100,
  ...over,
});

const opts = (over: Partial<ScanOptions> = {}): ScanOptions => ({
  scanText: '',
  recursive: false,
  maxRecursionSteps: 0,
  budget: 10000,
  caseSensitive: false,
  matchWholeWords: false,
  chatIdHash: 0,
  ...over,
});

describe('scanLorebook: basic activation', () => {
  test('matches single keyword', () => {
    const r = scanLorebook(
      [entry({ keys: ['forest'], content: 'Trees everywhere.' })],
      opts({ scanText: 'We walked through the forest.' }),
    );
    expect(r.before).toEqual(['Trees everywhere.']);
  });

  test('no match → empty result', () => {
    const r = scanLorebook(
      [entry({ keys: ['forest'] })],
      opts({ scanText: 'We walked through the desert.' }),
    );
    expect(r.before).toEqual([]);
    expect(r.activated).toEqual([]);
  });

  test('disabled entries skip', () => {
    const r = scanLorebook(
      [entry({ keys: ['forest'], enabled: false })],
      opts({ scanText: 'forest' }),
    );
    expect(r.before).toEqual([]);
  });

  test('constant entries always activate, ignore keys', () => {
    const r = scanLorebook(
      [entry({ keys: ['nevermatched'], constant: true, content: 'always' })],
      opts({ scanText: 'unrelated' }),
    );
    expect(r.before).toEqual(['always']);
  });

  test('any of multiple primary keys', () => {
    const r = scanLorebook(
      [entry({ keys: ['wood', 'forest', 'trees'] })],
      opts({ scanText: 'lots of trees here' }),
    );
    expect(r.activated).toHaveLength(1);
  });
});

describe('scanLorebook: case sensitivity', () => {
  test('insensitive by default', () => {
    const r = scanLorebook(
      [entry({ keys: ['Forest'] })],
      opts({ scanText: 'the FOREST' }),
    );
    expect(r.activated).toHaveLength(1);
  });

  test('per-entry case_sensitive', () => {
    const r = scanLorebook(
      [entry({ keys: ['Forest'], case_sensitive: true })],
      opts({ scanText: 'the forest' }),
    );
    expect(r.activated).toHaveLength(0);
  });

  test('global override', () => {
    const r = scanLorebook(
      [entry({ keys: ['Forest'] })],
      opts({ scanText: 'forest', caseSensitive: true }),
    );
    expect(r.activated).toHaveLength(0);
  });
});

describe('scanLorebook: whole-word matching', () => {
  test('substring by default', () => {
    const r = scanLorebook(
      [entry({ keys: ['fore'] })],
      opts({ scanText: 'forest' }),
    );
    expect(r.activated).toHaveLength(1);
  });

  test('whole-word rejects substring', () => {
    const r = scanLorebook(
      [entry({ keys: ['fore'], match_whole_words: true })],
      opts({ scanText: 'forest' }),
    );
    expect(r.activated).toHaveLength(0);
  });

  test('whole-word accepts exact', () => {
    const r = scanLorebook(
      [entry({ keys: ['fore'], match_whole_words: true })],
      opts({ scanText: 'to the fore!' }),
    );
    expect(r.activated).toHaveLength(1);
  });
});

describe('scanLorebook: regex keys', () => {
  test('/pattern/ key compiles and matches', () => {
    const r = scanLorebook(
      [entry({ keys: ['/dragon|wyrm/i'] })],
      opts({ scanText: 'a great Wyrm appeared' }),
    );
    expect(r.activated).toHaveLength(1);
  });

  test('bad regex falls back to literal', () => {
    const r = scanLorebook(
      [entry({ keys: ['/[unclosed/'] })],
      opts({ scanText: '/[unclosed/' }),  // matches as literal substring
    );
    expect(r.activated).toHaveLength(1);
  });
});

describe('scanLorebook: secondary keys (selectiveLogic)', () => {
  // primary always required; logic governs secondary

  test('AND_ANY (0): any secondary must match', () => {
    const e = entry({
      keys: ['forest'],
      secondary_keys: ['dark', 'spooky'],
      selectiveLogic: 0,
    });
    expect(scanLorebook([e], opts({ scanText: 'dark forest' })).activated).toHaveLength(1);
    expect(scanLorebook([e], opts({ scanText: 'sunny forest' })).activated).toHaveLength(0);
  });

  test('NOT_ALL (1): NOT all secondaries match', () => {
    const e = entry({
      keys: ['forest'],
      secondary_keys: ['dark', 'spooky'],
      selectiveLogic: 1,
    });
    // forest + dark only → not all → activate
    expect(scanLorebook([e], opts({ scanText: 'dark forest' })).activated).toHaveLength(1);
    // forest + dark + spooky → all matched → reject
    expect(scanLorebook([e], opts({ scanText: 'dark spooky forest' })).activated).toHaveLength(0);
  });

  test('NOT_ANY (2): no secondary matches', () => {
    const e = entry({
      keys: ['forest'],
      secondary_keys: ['dark'],
      selectiveLogic: 2,
    });
    expect(scanLorebook([e], opts({ scanText: 'sunny forest' })).activated).toHaveLength(1);
    expect(scanLorebook([e], opts({ scanText: 'dark forest' })).activated).toHaveLength(0);
  });

  test('AND_ALL (3): all secondaries match', () => {
    const e = entry({
      keys: ['forest'],
      secondary_keys: ['dark', 'spooky'],
      selectiveLogic: 3,
    });
    expect(scanLorebook([e], opts({ scanText: 'dark spooky forest' })).activated).toHaveLength(1);
    expect(scanLorebook([e], opts({ scanText: 'dark forest' })).activated).toHaveLength(0);
  });

  test('selective: false ignores secondary entirely', () => {
    const e = entry({
      keys: ['forest'],
      secondary_keys: ['dark'],
      selective: false,
      selectiveLogic: 0,
    });
    expect(scanLorebook([e], opts({ scanText: 'sunny forest' })).activated).toHaveLength(1);
  });
});

describe('scanLorebook: recursion', () => {
  test('activated content can trigger more entries', () => {
    const r = scanLorebook(
      [
        entry({ id: 'e1', keys: ['forest'], content: 'A dragon lives here.' }),
        entry({ id: 'e2', keys: ['dragon'], content: 'Dragons breathe fire.' }),
      ],
      opts({ scanText: 'walked into the forest', recursive: true }),
    );
    expect(r.activated.map((e) => e.id).sort()).toEqual(['e1', 'e2']);
  });

  test('recursion off → no chain', () => {
    const r = scanLorebook(
      [
        entry({ id: 'e1', keys: ['forest'], content: 'A dragon lives here.' }),
        entry({ id: 'e2', keys: ['dragon'], content: 'fire' }),
      ],
      opts({ scanText: 'forest', recursive: false }),
    );
    expect(r.activated.map((e) => e.id)).toEqual(['e1']);
  });

  test('excludeRecursion: this entry cannot trigger others', () => {
    const r = scanLorebook(
      [
        entry({ id: 'e1', keys: ['forest'], content: 'dragon', excludeRecursion: true }),
        entry({ id: 'e2', keys: ['dragon'], content: 'fire' }),
      ],
      opts({ scanText: 'forest', recursive: true }),
    );
    expect(r.activated.map((e) => e.id)).toEqual(['e1']);
  });

  test('preventRecursion: this entry cannot be triggered by recursion', () => {
    const r = scanLorebook(
      [
        entry({ id: 'e1', keys: ['forest'], content: 'dragon' }),
        entry({ id: 'e2', keys: ['dragon'], content: 'fire', preventRecursion: true }),
      ],
      opts({ scanText: 'forest', recursive: true }),
    );
    expect(r.activated.map((e) => e.id)).toEqual(['e1']);
  });

  test('delayUntilRecursion: only checks on pass N+', () => {
    const r = scanLorebook(
      [
        entry({ id: 'e1', keys: ['a'], content: 'b' }),
        entry({ id: 'e2', keys: ['b'], content: 'c' }),
        // e3 only checks on recursion step 2 (the b→c hop)
        entry({ id: 'e3', keys: ['c'], content: 'd', delayUntilRecursion: 2 }),
      ],
      opts({ scanText: 'a', recursive: true }),
    );
    expect(r.activated.map((e) => e.id).sort()).toEqual(['e1', 'e2', 'e3']);
  });

  test('maxRecursionSteps caps the chain', () => {
    const r = scanLorebook(
      [
        entry({ id: 'e1', keys: ['a'], content: 'b' }),
        entry({ id: 'e2', keys: ['b'], content: 'c' }),
        entry({ id: 'e3', keys: ['c'], content: 'd' }),
      ],
      opts({ scanText: 'a', recursive: true, maxRecursionSteps: 1 }),
    );
    expect(r.activated.map((e) => e.id).sort()).toEqual(['e1', 'e2']);
  });

  test('recursion does not loop on already-activated', () => {
    // e1 → e2 → e1 would loop infinitely without dedup.
    const r = scanLorebook(
      [
        entry({ id: 'e1', keys: ['a'], content: 'b' }),
        entry({ id: 'e2', keys: ['b'], content: 'a' }),
      ],
      opts({ scanText: 'a', recursive: true }),
    );
    expect(r.activated).toHaveLength(2);
  });
});

describe('scanLorebook: groups (mutual exclusion)', () => {
  test('one entry per group survives', () => {
    const r = scanLorebook(
      [
        entry({ id: 'e1', keys: ['x'], group: 'weather', groupWeight: 100 }),
        entry({ id: 'e2', keys: ['x'], group: 'weather', groupWeight: 100 }),
        entry({ id: 'e3', keys: ['x'], group: '' }),  // ungrouped, survives
      ],
      opts({ scanText: 'x' }),
    );
    const grouped = r.activated.filter((e) => e.group === 'weather');
    expect(grouped).toHaveLength(1);
    expect(r.activated.find((e) => e.id === 'e3')).toBeDefined();
  });

  test('groupOverride wins over weight', () => {
    const r = scanLorebook(
      [
        entry({ id: 'e1', keys: ['x'], group: 'g', groupWeight: 1000 }),
        entry({ id: 'e2', keys: ['x'], group: 'g', groupOverride: true }),
      ],
      opts({ scanText: 'x' }),
    );
    expect(r.activated.map((e) => e.id)).toEqual(['e2']);
  });

  test('group selection is stable per chatIdHash', () => {
    const entries = [
      entry({ id: 'e1', keys: ['x'], group: 'g' }),
      entry({ id: 'e2', keys: ['x'], group: 'g' }),
    ];
    const r1 = scanLorebook(entries, opts({ scanText: 'x', chatIdHash: 7 }));
    const r2 = scanLorebook(entries, opts({ scanText: 'x', chatIdHash: 7 }));
    expect(r1.activated[0]?.id).toBe(r2.activated[0]?.id);
  });
});

describe('scanLorebook: budget', () => {
  test('drops entries over budget, lower order survives', () => {
    // estimateTokens('x'.repeat(40)) ≈ 12. budget=15 fits one.
    const r = scanLorebook(
      [
        entry({ id: 'e1', keys: ['x'], content: 'x'.repeat(40), insertion_order: 1 }),
        entry({ id: 'e2', keys: ['x'], content: 'x'.repeat(40), insertion_order: 2 }),
      ],
      opts({ scanText: 'x', budget: 15 }),
    );
    expect(r.activated.map((e) => e.id)).toEqual(['e1']);
    expect(r.budgetExceeded).toBe(true);
  });

  test('ignoreBudget bypasses', () => {
    const r = scanLorebook(
      [
        entry({ id: 'e1', keys: ['x'], content: 'x'.repeat(40), insertion_order: 1 }),
        entry({ id: 'e2', keys: ['x'], content: 'x'.repeat(40), insertion_order: 2, ignoreBudget: true }),
      ],
      opts({ scanText: 'x', budget: 15 }),
    );
    expect(r.activated.map((e) => e.id).sort()).toEqual(['e1', 'e2']);
  });
});

describe('scanLorebook: position bucketing', () => {
  test('before/after split correctly', () => {
    const r = scanLorebook(
      [
        entry({ id: 'e1', keys: ['x'], content: 'BEFORE', position: 'before_char' }),
        entry({ id: 'e2', keys: ['x'], content: 'AFTER', position: 'after_char' }),
      ],
      opts({ scanText: 'x' }),
    );
    expect(r.before).toEqual(['BEFORE']);
    expect(r.after).toEqual(['AFTER']);
  });

  test('at_depth bucket', () => {
    const r = scanLorebook(
      [entry({ keys: ['x'], content: 'DEEP', position: 'at_depth', depth: 4 })],
      opts({ scanText: 'x' }),
    );
    expect(r.atDepth).toEqual([{ depth: 4, role: 'system', content: 'DEEP' }]);
  });

  test('insertion_order sorts within bucket', () => {
    const r = scanLorebook(
      [
        entry({ id: 'e1', keys: ['x'], content: 'second', insertion_order: 200 }),
        entry({ id: 'e2', keys: ['x'], content: 'first', insertion_order: 100 }),
      ],
      opts({ scanText: 'x' }),
    );
    expect(r.before).toEqual(['first', 'second']);
  });
});

describe('scanLorebook: probability', () => {
  test('100% always activates', () => {
    const r = scanLorebook(
      [entry({ keys: ['x'], probability: 100 })],
      opts({ scanText: 'x' }),
    );
    expect(r.activated).toHaveLength(1);
  });

  test('0% never activates', () => {
    const r = scanLorebook(
      [entry({ keys: ['x'], probability: 0 })],
      opts({ scanText: 'x' }),
    );
    expect(r.activated).toHaveLength(0);
  });

  test('probability roll is stable per chatIdHash', () => {
    const e = entry({ keys: ['x'], probability: 50 });
    const r1 = scanLorebook([e], opts({ scanText: 'x', chatIdHash: 13 }));
    const r2 = scanLorebook([e], opts({ scanText: 'x', chatIdHash: 13 }));
    expect(r1.activated.length).toBe(r2.activated.length);
  });
});
