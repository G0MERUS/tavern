// ─────────────────────────────────────────────────────────────────────────────
// The {{...}} substitution engine. The original is a chevrotain CST walker;
// we recursive-descent it. Same surface, much smaller. These tests pin the
// behaviour: case-insensitive lookup, inside-out evaluation, the fallthrough
// to {{getvar}}, the side-effecting variable macros.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, test, expect } from 'vitest';
import { evaluateMacros, type MacroEnv } from '$lib/core/macros/engine';

const env = (overrides: Partial<MacroEnv> = {}): MacroEnv => ({
  user: 'Alice',
  char: 'Seraphina',
  persona: 'A curious explorer.',
  description: 'A guardian spirit of Eldoria forest.',
  personality: 'Kind, protective.',
  scenario: 'Deep in the woods.',
  model: 'gpt-4',
  chatVars: {},
  globalVars: {},
  messageCount: 5,
  lastMessage: 'Hello there.',
  lastUserMessage: 'Hi!',
  lastCharMessage: 'Hello there.',
  generationType: 'normal',
  chatIdHash: 0,
  ...overrides,
});

describe('macros: env lookup', () => {
  test('substitutes {{user}} and {{char}}', () => {
    const out = evaluateMacros('{{user}} talks to {{char}}.', env());
    expect(out).toBe('Alice talks to Seraphina.');
  });

  test('is case-insensitive', () => {
    expect(evaluateMacros('{{User}} {{CHAR}} {{uSeR}}', env())).toBe('Alice Seraphina Alice');
  });

  test('preserves surrounding text exactly', () => {
    const out = evaluateMacros('  *{{char}}*\n  yawns', env());
    expect(out).toBe('  *Seraphina*\n  yawns');
  });

  test('{{group}} is empty (groups dead, but macro must exist for compat)', () => {
    expect(evaluateMacros('[{{group}}]', env())).toBe('[]');
  });
});

describe('macros: utilities', () => {
  test('{{newline}}', () => {
    expect(evaluateMacros('a{{newline}}b', env())).toBe('a\nb');
  });

  test('{{upper}} / {{lower}}', () => {
    expect(evaluateMacros('{{upper::hello}}', env())).toBe('HELLO');
    expect(evaluateMacros('{{lower::WORLD}}', env())).toBe('world');
  });

  test('{{trim}} block', () => {
    expect(evaluateMacros('{{#trim}}  spaced  {{/trim}}', env())).toBe('spaced');
  });

  test('arithmetic', () => {
    expect(evaluateMacros('{{add::2::3}}', env())).toBe('5');
    expect(evaluateMacros('{{sub::10::3}}', env())).toBe('7');
    expect(evaluateMacros('{{mul::4::5}}', env())).toBe('20');
    expect(evaluateMacros('{{max::1::5::3}}', env())).toBe('5');
  });
});

describe('macros: nesting (inside-out evaluation)', () => {
  test('inner macros evaluate before outer', () => {
    const out = evaluateMacros('{{upper::{{char}}}}', env());
    expect(out).toBe('SERAPHINA');
  });

  test('three levels', () => {
    const out = evaluateMacros('{{upper::{{lower::{{char}}}}}}', env());
    expect(out).toBe('SERAPHINA');
  });

  test('respects max depth', () => {
    // Pathological self-reference via variable. Should bail at depth limit,
    // not stack-overflow.
    const e = env({ chatVars: { x: '{{getvar::x}}' } });
    expect(() => evaluateMacros('{{getvar::x}}', e)).not.toThrow();
  });
});

describe('macros: variables', () => {
  test('{{getvar}} reads chat scope', () => {
    const e = env({ chatVars: { mood: 'tense' } });
    expect(evaluateMacros('Mood is {{getvar::mood}}.', e)).toBe('Mood is tense.');
  });

  test('{{setvar}} mutates env, returns empty', () => {
    const e = env();
    const out = evaluateMacros('{{setvar::seen::yes}}done', e);
    expect(out).toBe('done');
    expect(e.chatVars['seen']).toBe('yes');
  });

  test('{{incvar}} returns the new value', () => {
    const e = env({ chatVars: { count: '5' } });
    expect(evaluateMacros('{{incvar::count}}', e)).toBe('6');
    expect(e.chatVars['count']).toBe('6');
  });

  test('{{addvar}} on non-numeric falls back to 0', () => {
    const e = env({ chatVars: { x: 'abc' } });
    evaluateMacros('{{addvar::x::3}}', e);
    expect(e.chatVars['x']).toBe('3');
  });

  test('unknown macro falls through to getvar', () => {
    // The gotcha: {{anything}} → {{getvar::anything}} if not registered.
    const e = env({ chatVars: { mood: 'happy' } });
    expect(evaluateMacros('{{mood}}', e)).toBe('happy');
  });

  test('unknown macro + unknown var → empty string', () => {
    expect(evaluateMacros('[{{nonexistent}}]', env())).toBe('[]');
  });

  test('global vars', () => {
    const e = env({ globalVars: { theme: 'dark' } });
    expect(evaluateMacros('{{getglobalvar::theme}}', e)).toBe('dark');
  });
});

describe('macros: random (seeded for stability)', () => {
  test('{{random}} picks one option', () => {
    const out = evaluateMacros('{{random::a::b::c}}', env());
    expect(['a', 'b', 'c']).toContain(out);
  });

  test('{{random}} is stable for same chatIdHash', () => {
    const e1 = env({ chatIdHash: 42 });
    const e2 = env({ chatIdHash: 42 });
    const r1 = evaluateMacros('{{random::a::b::c::d::e}}', e1);
    const r2 = evaluateMacros('{{random::a::b::c::d::e}}', e2);
    expect(r1).toBe(r2);
  });

  test('{{random}} differs for different chatIdHash', () => {
    // Probabilistic but deterministic given our PRNG. Wide enough option set.
    const out = new Set(
      [1, 2, 3, 4, 5].map((h) =>
        evaluateMacros('{{random::a::b::c::d::e::f::g::h}}', env({ chatIdHash: h })),
      ),
    );
    expect(out.size).toBeGreaterThan(1);
  });

  test('{{roll::1d6}} stays in range', () => {
    for (let i = 0; i < 20; i++) {
      const out = Number(evaluateMacros('{{roll::1d6}}', env({ chatIdHash: i })));
      expect(out).toBeGreaterThanOrEqual(1);
      expect(out).toBeLessThanOrEqual(6);
    }
  });

  test('{{roll::2d6+3}} respects modifier', () => {
    const out = Number(evaluateMacros('{{roll::2d6+3}}', env()));
    expect(out).toBeGreaterThanOrEqual(5);  // 2+3
    expect(out).toBeLessThanOrEqual(15); // 12+3
  });
});

describe('macros: conditionals', () => {
  test('{{#if}} truthy', () => {
    expect(evaluateMacros('{{#if yes}}true{{/if}}', env())).toBe('true');
  });

  test('{{#if}} falsy → empty', () => {
    expect(evaluateMacros('{{#if }}true{{/if}}', env())).toBe('');
    expect(evaluateMacros('{{#if 0}}true{{/if}}', env())).toBe('');
    expect(evaluateMacros('{{#if false}}true{{/if}}', env())).toBe('');
  });

  test('{{#if}}{{else}}{{/if}}', () => {
    expect(evaluateMacros('{{#if }}a{{else}}b{{/if}}', env())).toBe('b');
    expect(evaluateMacros('{{#if x}}a{{else}}b{{/if}}', env())).toBe('a');
  });

  test('comparisons', () => {
    expect(evaluateMacros('{{#if 5>3}}yes{{/if}}', env())).toBe('yes');
    expect(evaluateMacros('{{#if 5<3}}yes{{else}}no{{/if}}', env())).toBe('no');
    expect(evaluateMacros('{{#if a==a}}yes{{/if}}', env())).toBe('yes');
  });

  test('condition expands macros first', () => {
    const e = env({ chatVars: { hp: '10' } });
    expect(evaluateMacros('{{#if {{getvar::hp}}>5}}alive{{/if}}', e)).toBe('alive');
  });

  test('nested same-name blocks', () => {
    // The original chevrotain engine handles this; the naive indexOf(closeTag)
    // approach finds the inner {{/if}} and corrupts. Depth-count fixes it.
    const out = evaluateMacros('{{#if a}}[{{#if b}}inner{{/if}}]{{/if}}', env());
    expect(out).toBe('[inner]');
  });

  test('nested {{else}} belongs to inner block', () => {
    const out = evaluateMacros(
      '{{#if a}}{{#if 0}}no{{else}}yes{{/if}}{{else}}OUTER{{/if}}',
      env(),
    );
    expect(out).toBe('yes');
  });
});

describe('macros: comments and noise', () => {
  test('{{// comment}} → empty', () => {
    expect(evaluateMacros('a{{// hidden}}b', env())).toBe('ab');
  });

  test('unclosed macro stays literal', () => {
    expect(evaluateMacros('{{user', env())).toBe('{{user');
  });

  test('unmatched close stays literal', () => {
    expect(evaluateMacros('}}', env())).toBe('}}');
  });

  test('non-macro braces survive', () => {
    expect(evaluateMacros('{x}', env())).toBe('{x}');
  });

  test('empty input', () => {
    expect(evaluateMacros('', env())).toBe('');
  });
});

describe('macros: time', () => {
  test('{{date}} is YYYY-MM-DD', () => {
    expect(evaluateMacros('{{date}}', env())).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('{{time}} is HH:mm', () => {
    expect(evaluateMacros('{{time}}', env())).toMatch(/^\d{2}:\d{2}$/);
  });
});
