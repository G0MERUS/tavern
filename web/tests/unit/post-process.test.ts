import { describe, test, expect } from 'vitest';
import { postProcessMessages } from '$lib/core/post-process';
import type { ChatMessage } from '$lib/api/types';

const m = (role: ChatMessage['role'], content: string): ChatMessage => ({ role, content });

describe('postProcessMessages: none', () => {
  test('passthrough', () => {
    const input = [m('system', 's'), m('user', 'u'), m('assistant', 'a')];
    expect(postProcessMessages(input, 'none')).toEqual(input);
  });
});

describe('postProcessMessages: merge', () => {
  test('collapses consecutive same-role', () => {
    const out = postProcessMessages(
      [m('user', 'a'), m('user', 'b'), m('assistant', 'c')],
      'merge',
    );
    expect(out).toEqual([m('user', 'a\n\nb'), m('assistant', 'c')]);
  });

  test('always merges consecutive system', () => {
    const out = postProcessMessages(
      [m('system', 's1'), m('system', 's2'), m('user', 'u')],
      'merge',
    );
    expect(out).toEqual([m('system', 's1\n\ns2'), m('user', 'u')]);
  });

  test('three in a row', () => {
    const out = postProcessMessages(
      [m('user', 'a'), m('user', 'b'), m('user', 'c')],
      'merge',
    );
    expect(out).toEqual([m('user', 'a\n\nb\n\nc')]);
  });
});

describe('postProcessMessages: semi', () => {
  test('merges + ensures user-first', () => {
    const out = postProcessMessages(
      [m('system', 's'), m('assistant', 'a')],
      'semi',
    );
    expect(out[0]?.role).toBe('system');
    expect(out[1]?.role).toBe('user');  // empty user inserted
    expect(out[2]?.role).toBe('assistant');
  });

  test('does not insert if user already first', () => {
    const out = postProcessMessages(
      [m('system', 's'), m('user', 'u')],
      'semi',
    );
    expect(out).toEqual([m('system', 's'), m('user', 'u')]);
  });
});

describe('postProcessMessages: strict', () => {
  test('enforces alternation', () => {
    const out = postProcessMessages(
      [m('system', 's'), m('user', 'u'), m('user', 'u2'), m('assistant', 'a')],
      'strict',
    );
    // u and u2 should have merged (strict implies merge)
    const nonSys = out.filter((m) => m.role !== 'system');
    for (let i = 1; i < nonSys.length; i++) {
      expect(nonSys[i]?.role).not.toBe(nonSys[i - 1]?.role);
    }
  });

  test('inserts empties to enforce alternation', () => {
    // After merge: user, assistant, assistant — needs an empty user between
    const out = postProcessMessages(
      [m('user', 'u'), m('assistant', 'a1'), m('system', 's'), m('assistant', 'a2')],
      'strict',
    );
    // The system in the middle goes away (hoisted or dropped depending on impl);
    // what we care about is no consecutive same-role in the result.
    const nonSys = out.filter((m) => m.role !== 'system');
    for (let i = 1; i < nonSys.length; i++) {
      expect(nonSys[i]?.role).not.toBe(nonSys[i - 1]?.role);
    }
  });
});

describe('postProcessMessages: single', () => {
  test('collapses everything to one user message', () => {
    const out = postProcessMessages(
      [m('system', 's'), m('user', 'u'), m('assistant', 'a')],
      'single',
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.role).toBe('user');
    expect(out[0]?.content).toContain('s');
    expect(out[0]?.content).toContain('u');
    expect(out[0]?.content).toContain('a');
  });
});
