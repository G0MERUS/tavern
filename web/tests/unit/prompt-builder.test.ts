// ─────────────────────────────────────────────────────────────────────────────
// Prompt assembly. The Generate() pipeline boiled down: stack the system
// prompts, fold in lore, walk the chat, expand macros. Zero side effects —
// pure data in, ChatMessage[] out.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, test, expect } from 'vitest';
import { buildPrompt, type BuildContext } from '$lib/core/prompt-builder';
import type { Message } from '$lib/api/types';

const ctx = (over: Partial<BuildContext> = {}): BuildContext => ({
  character: {
    name: 'Seraphina',
    description: 'A guardian spirit.',
    personality: 'Kind.',
    scenario: 'Forest.',
    first_mes: 'Hello.',
    mes_example: '',
    system_prompt: '',
    post_history_instructions: '',
    creator_notes: '',
    alternate_greetings: [],
    tags: [],
    creator: '',
    character_version: '',
    extensions: {},
  },
  persona: { name: 'Alice', description: 'Curious.' },
  messages: [],
  metadata: {},
  systemPromptTemplate: 'Write {{char}}\'s next reply to {{user}}.',
  loreBefore: [],
  loreAfter: [],
  loreAtDepth: [],
  authorsNote: null,
  generationType: 'normal',
  ...over,
});

const msg = (over: Partial<Message>): Message => ({
  id: 'm1',
  chat_id: 'c1',
  position: 1024,
  role: 'user',
  character_id: null,
  content: '',
  swipes: [],
  swipe_idx: 0,
  extra: {},
  is_hidden: false,
  created_at: 0,
  ...over,
});

describe('buildPrompt: system prompt', () => {
  test('expands {{char}} and {{user}} in template', () => {
    const out = buildPrompt(ctx());
    expect(out[0]?.role).toBe('system');
    expect(out[0]?.content).toContain('Seraphina');
    expect(out[0]?.content).toContain('Alice');
  });

  test('character.system_prompt overrides template', () => {
    const out = buildPrompt(ctx({
      character: { ...ctx().character, system_prompt: 'Custom: {{char}}.' },
    }));
    expect(out[0]?.content).toBe('Custom: Seraphina.');
  });

  test('includes character description', () => {
    const out = buildPrompt(ctx());
    const sys = out.filter((m) => m.role === 'system').map((m) => m.content).join(' ');
    expect(sys).toContain('A guardian spirit.');
  });
});

describe('buildPrompt: lorebook injection', () => {
  test('before-lore precedes character description', () => {
    const out = buildPrompt(ctx({ loreBefore: ['LORE_BEFORE'] }));
    const sysContents = out.filter((m) => m.role === 'system').map((m) => String(m.content));
    const beforeIdx = sysContents.findIndex((c) => c.includes('LORE_BEFORE'));
    const descIdx = sysContents.findIndex((c) => c.includes('guardian spirit'));
    expect(beforeIdx).toBeGreaterThanOrEqual(0);
    expect(beforeIdx).toBeLessThan(descIdx);
  });

  test('after-lore follows character description', () => {
    const out = buildPrompt(ctx({ loreAfter: ['LORE_AFTER'] }));
    const sysContents = out.filter((m) => m.role === 'system').map((m) => String(m.content));
    const afterIdx = sysContents.findIndex((c) => c.includes('LORE_AFTER'));
    const descIdx = sysContents.findIndex((c) => c.includes('guardian spirit'));
    expect(afterIdx).toBeGreaterThan(descIdx);
  });

  test('at-depth lore splices into chat history', () => {
    const out = buildPrompt(ctx({
      messages: [
        msg({ id: 'm1', role: 'user', content: 'first' }),
        msg({ id: 'm2', role: 'assistant', content: 'second' }),
        msg({ id: 'm3', role: 'user', content: 'third' }),
      ],
      loreAtDepth: [{ depth: 1, role: 'system', content: 'INJECTED' }],
    }));
    // depth=1 → 1 from end → between m2 and m3.
    const idx = out.findIndex((m) => m.content === 'INJECTED');
    const thirdIdx = out.findIndex((m) => m.content === 'third');
    expect(idx).toBe(thirdIdx - 1);
  });
});

describe('buildPrompt: chat history', () => {
  test('maps message roles', () => {
    const out = buildPrompt(ctx({
      messages: [
        msg({ role: 'user', content: 'hi' }),
        msg({ role: 'assistant', content: 'hello' }),
      ],
    }));
    expect(out.find((m) => m.role === 'user')?.content).toBe('hi');
    expect(out.find((m) => m.role === 'assistant')?.content).toBe('hello');
  });

  test('skips is_hidden messages', () => {
    const out = buildPrompt(ctx({
      messages: [msg({ role: 'user', content: 'GHOST', is_hidden: true })],
    }));
    expect(out.find((m) => m.content === 'GHOST')).toBeUndefined();
  });

  test('history follows system prompts', () => {
    const out = buildPrompt(ctx({
      messages: [msg({ role: 'user', content: 'hi' })],
    }));
    const userIdx = out.findIndex((m) => m.content === 'hi');
    const sysIdx = out.findIndex((m) => m.role === 'system');
    expect(userIdx).toBeGreaterThan(sysIdx);
  });
});

describe('buildPrompt: scenario override', () => {
  test('chat metadata.scenario wins over character.scenario', () => {
    const out = buildPrompt(ctx({
      character: { ...ctx().character, scenario: 'CHAR_SCENARIO' },
      metadata: { scenario: 'OVERRIDE_SCENARIO' },
    }));
    const all = out.map((m) => m.content).join(' ');
    expect(all).toContain('OVERRIDE_SCENARIO');
    expect(all).not.toContain('CHAR_SCENARIO');
  });
});

describe('buildPrompt: regenerate/swipe omits last assistant', () => {
  test('swipe drops the last bot message', () => {
    const out = buildPrompt(ctx({
      messages: [
        msg({ id: 'm1', role: 'user', content: 'q' }),
        msg({ id: 'm2', role: 'assistant', content: 'TO_REPLACE' }),
      ],
      generationType: 'swipe',
    }));
    expect(out.find((m) => m.content === 'TO_REPLACE')).toBeUndefined();
    expect(out.find((m) => m.content === 'q')).toBeDefined();
  });

  test('continue keeps the last bot message (it is the prefill)', () => {
    const out = buildPrompt(ctx({
      messages: [
        msg({ id: 'm1', role: 'user', content: 'q' }),
        msg({ id: 'm2', role: 'assistant', content: 'partial' }),
      ],
      generationType: 'continue',
    }));
    expect(out.at(-1)?.content).toBe('partial');
    expect(out.at(-1)?.role).toBe('assistant');
  });
});

describe('buildPrompt: authors note', () => {
  test('injected at depth', () => {
    const out = buildPrompt(ctx({
      messages: [
        msg({ id: 'm1', role: 'user', content: 'a' }),
        msg({ id: 'm2', role: 'assistant', content: 'b' }),
      ],
      authorsNote: { content: 'AN', depth: 0, role: 'system' },
    }));
    // depth=0 → at the very end of history.
    const last = out.at(-1);
    expect(last?.content).toBe('AN');
  });
});

describe('buildPrompt: post_history_instructions', () => {
  test('appended after chat history', () => {
    const out = buildPrompt(ctx({
      character: { ...ctx().character, post_history_instructions: 'JAILBREAK' },
      messages: [msg({ role: 'user', content: 'hi' })],
    }));
    const jbIdx = out.findIndex((m) => String(m.content).includes('JAILBREAK'));
    const hiIdx = out.findIndex((m) => m.content === 'hi');
    expect(jbIdx).toBeGreaterThan(hiIdx);
  });
});

describe('buildPrompt: impersonate nudge', () => {
  test('appends impersonation_prompt as end-of-prompt system message', () => {
    const out = buildPrompt(ctx({
      messages: [msg({ role: 'user', content: 'hi' })],
      generationType: 'impersonate',
    }));
    // Default template in DEFAULT_TEMPLATES writes from {{user}}'s POV.
    // {{user}}/{{char}} are macro-expanded to the persona/character names.
    const last = out.at(-1)!;
    expect(last.role).toBe('system');
    expect(String(last.content)).toContain('Alice');
    expect(String(last.content)).toContain('Seraphina');
    // Literal macro placeholders should have been substituted out.
    expect(String(last.content)).not.toContain('{{user}}');
  });

  test('not appended on normal generation', () => {
    const out = buildPrompt(ctx({
      messages: [msg({ role: 'user', content: 'hi' })],
      generationType: 'normal',
    }));
    const joined = out.map((m) => String(m.content)).join(' ');
    expect(joined.toLowerCase()).not.toContain('write your next reply from the point of view');
  });

  test('honors custom impersonation_prompt template', () => {
    const out = buildPrompt(ctx({
      messages: [msg({ role: 'user', content: 'hi' })],
      generationType: 'impersonate',
      templates: {
        impersonation_prompt: '[CUSTOM IMP as {{user}}]',
        continue_nudge_prompt: '',
        new_chat_prompt: '',
        new_example_chat_prompt: '',
        wi_format: '{0}',
        scenario_format: '{{scenario}}',
        personality_format: '{{personality}}',
        send_if_empty: '',
        assistant_prefill: '',
        assistant_impersonation: '',
      },
    }));
    const last = out.at(-1)!;
    expect(last.role).toBe('system');
    expect(last.content).toBe('[CUSTOM IMP as Alice]');
  });

  test('skips entirely when impersonation_prompt template is empty', () => {
    const out = buildPrompt(ctx({
      messages: [msg({ role: 'user', content: 'hi' })],
      generationType: 'impersonate',
      templates: {
        impersonation_prompt: '',
        continue_nudge_prompt: '',
        new_chat_prompt: '',
        new_example_chat_prompt: '',
        wi_format: '{0}',
        scenario_format: '{{scenario}}',
        personality_format: '{{personality}}',
        send_if_empty: '',
        assistant_prefill: '',
        assistant_impersonation: '',
      },
    }));
    // Last message should be the user turn — no impersonation nudge.
    expect(out.at(-1)?.content).toBe('hi');
  });
});
