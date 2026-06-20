// ─────────────────────────────────────────────────────────────────────────────
// Prompt assembly. Walks preset.promptOrder, resolves markers, splices
// absolute injections into chat history. Pure function: data in,
// ChatMessage[] out.
//
// Marker resolution: each of the 8 markers maps to a slice of BuildContext.
// The marker's *position in the order* determines where that content sits in
// the final stack. The marker's `role` overrides the default 'system' for the
// 6 in PROMPT_SOURCES (charDescription etc).
//
// Character override: card.system_prompt replaces main.content unless
// main.forbid_overrides; same for jailbreak ↔ post_history_instructions.
//
// All text fields run through the macro engine. Lore is pre-expanded by the
// caller (the scan happens before this).
// ─────────────────────────────────────────────────────────────────────────────

import type { Message, CardData, ChatMessage, ChatMetadata, PromptDefinition, PresetTemplates } from '../api/types';
import type { DepthInjection } from './worldinfo-scan';
import { evaluateMacros, type MacroEnv } from './macros/engine';
import { stringHash } from '../utils/hash';
import { DEFAULT_PROMPTS, DEFAULT_ORDER, DEFAULT_TEMPLATES } from './preset-defaults';

// Re-exported for callers that don't import from api/types directly.
export type GenerationType = 'normal' | 'continue' | 'swipe' | 'regenerate' | 'impersonate' | 'quiet';

export interface AuthorsNote {
  content: string;
  /** 0 = at end, 1 = before last message, etc. */
  depth: number;
  role: 'system' | 'user' | 'assistant';
}

export interface BuildContext {
  character: CardData;
  persona: { name: string; description: string };
  /** Backend Message[] — already in position order. */
  messages: Message[];
  metadata: ChatMetadata;
  /** Pre-scanned, pre-macro'd lore strings. */
  loreBefore: string[];
  loreAfter: string[];
  loreAtDepth: DepthInjection[];
  authorsNote: AuthorsNote | null;
  generationType: GenerationType;

  /** Prompt pool. Optional — falls back to DEFAULT_PROMPTS for callers
      not yet wired (and tests). */
  prompts?: PromptDefinition[];
  promptOrder?: { identifier: string; enabled: boolean }[];
  templates?: PresetTemplates;

  /** @deprecated Migrated into prompts['main'].content. Kept for callers
      not yet updated; populates the main prompt when no pool is passed. */
  systemPromptTemplate?: string;
}

interface AbsoluteInjection {
  depth: number;
  order: number;
  role: ChatMessage['role'];
  content: string;
}

export function buildPrompt(ctx: BuildContext): ChatMessage[] {
  const env = buildMacroEnv(ctx);
  const expand = (s: string) => evaluateMacros(s, env);
  const out: ChatMessage[] = [];
  const push = (role: ChatMessage['role'], content: string) => {
    const c = expand(content).trim();
    if (c) out.push({ role, content: c });
  };

  // Resolve pool/order. Fall back to defaults so the legacy call shape
  // (no prompts/promptOrder) still works — the test suite and any caller
  // not yet updated take this path.
  const prompts = ctx.prompts ?? legacyPrompts(ctx);
  const order = ctx.promptOrder ?? DEFAULT_ORDER;
  const templates = ctx.templates ?? DEFAULT_TEMPLATES;

  const get = (id: string) => prompts.find((p) => p.identifier === id);

  // Absolute injections queue here; spliced into history at marker resolution.
  const absoluteInjections: AbsoluteInjection[] = [];

  for (const entry of order) {
    if (!entry.enabled) continue;
    const def = get(entry.identifier);
    if (!def) continue;
    if (!shouldTrigger(def, ctx.generationType)) continue;

    if (def.marker) {
      resolveMarker(def, ctx, templates, absoluteInjections, out, push);
    } else if (def.injection_position === 1) {
      // Absolute: queue for depth-splice into chat history.
      const content = expand(applyOverride(def, ctx)).trim();
      if (content) {
        absoluteInjections.push({
          depth: def.injection_depth,
          order: def.injection_order,
          role: def.role,
          content,
        });
      }
    } else {
      // Relative: push directly. Char override may swap in card content.
      push(def.role, applyOverride(def, ctx));
    }
  }

  // Impersonate: the preset's impersonation_prompt is appended as an
  // end-of-prompt system nudge. GenerationType was declared but never
  // plumbed — this is the plumbing. Guarded on templates so callers
  // without a preset (tests, legacy path) get the default template.
  if (ctx.generationType === 'impersonate') {
    const tmpl = templates.impersonation_prompt;
    if (tmpl) push('system', tmpl);
  }

  return out;
}

/** Empty trigger list = fires on all types. ST PromptManager.js 1546–1555. */
function shouldTrigger(def: PromptDefinition, type: GenerationType): boolean {
  return def.injection_trigger.length === 0 || def.injection_trigger.includes(type);
}

/**
 * Char card override of main/jailbreak. card.system_prompt replaces
 * main.content unless main.forbid_overrides; same for jailbreak ↔
 * post_history_instructions.
 */
function applyOverride(def: PromptDefinition, ctx: BuildContext): string {
  if (def.identifier === 'main' && !def.forbid_overrides) {
    const override = ctx.character.system_prompt?.trim();
    if (override) return override;
  }
  if (def.identifier === 'jailbreak' && !def.forbid_overrides) {
    const override = ctx.character.post_history_instructions?.trim();
    if (override) return override;
  }
  return def.content;
}

// ── Marker resolution ────────────────────────────────────────────────────────
// Each marker pulls from BuildContext. The marker's own `role` overrides
// 'system' if set (the 6 in PROMPT_SOURCES are role-editable in the UI).

function resolveMarker(
  def: PromptDefinition,
  ctx: BuildContext,
  templates: PresetTemplates,
  absoluteInjections: AbsoluteInjection[],
  out: ChatMessage[],
  push: (role: ChatMessage['role'], content: string) => void,
): void {
  const role = def.role || 'system';

  switch (def.identifier) {
    case 'chatHistory': {
      const history = buildHistory(ctx);
      spliceDepthInjections(history, ctx.loreAtDepth, ctx.authorsNote, absoluteInjections);
      out.push(...history);
      // Drain — anything queued after chatHistory in order won't find a slot.
      absoluteInjections.length = 0;
      return;
    }

    case 'dialogueExamples':
      // TODO: parse ctx.character.mes_example (split on <START>), wrap each
      // in templates.new_example_chat_prompt. Stub for now.
      return;

    case 'worldInfoBefore':
      for (const lore of ctx.loreBefore) {
        const wrapped = wrapWI(lore, templates.wi_format);
        if (wrapped.trim()) out.push({ role, content: wrapped });
      }
      return;

    case 'worldInfoAfter':
      for (const lore of ctx.loreAfter) {
        const wrapped = wrapWI(lore, templates.wi_format);
        if (wrapped.trim()) out.push({ role, content: wrapped });
      }
      return;

    case 'charDescription':
      push(role, ctx.character.description);
      return;

    case 'charPersonality':
      push(role, wrap(ctx.character.personality, templates.personality_format, '{{personality}}'));
      return;

    case 'scenario':
      push(role, wrap(ctx.metadata.scenario ?? ctx.character.scenario, templates.scenario_format, '{{scenario}}'));
      return;

    case 'personaDescription':
      push(role, ctx.persona.description);
      return;
  }
}

/** ST inconsistency: WI uses {0}, others use macro syntax. Keep it. */
function wrapWI(content: string, fmt: string): string {
  return fmt.replace('{0}', content);
}

function wrap(content: string, fmt: string, placeholder: string): string {
  if (!content) return '';
  return fmt.replace(placeholder, content);
}

// ── History ──────────────────────────────────────────────────────────────────

function buildHistory(ctx: BuildContext): ChatMessage[] {
  let messages = ctx.messages.filter((m) => !m.is_hidden);

  // Swipe/regenerate: drop the last assistant message — we're replacing it.
  // Continue: keep it — it's the prefill we're extending.
  if (
    (ctx.generationType === 'swipe' || ctx.generationType === 'regenerate') &&
    messages.at(-1)?.role === 'assistant'
  ) {
    messages = messages.slice(0, -1);
  }

  return messages.map((m) => ({ role: m.role, content: m.content }));
}

/**
 * Splice depth injections into history. depth=0 → at end (after last
 * message), depth=1 → before last message, etc.
 *
 * Sources: lorebook at_depth entries, author's note, and any prompts with
 * injection_position=1 (queued above).
 *
 * Mutates `history`. Sorts deepest-first so indices stay valid; ties broken
 * by injection_order (lower = earlier).
 */
function spliceDepthInjections(
  history: ChatMessage[],
  loreAtDepth: DepthInjection[],
  authorsNote: AuthorsNote | null,
  absolute: AbsoluteInjection[],
): void {
  // Normalize all sources into one queue. Lore + AN have no order field;
  // give them 100 (the default) so they sort with prompts naturally.
  const queue: AbsoluteInjection[] = [
    ...loreAtDepth.map((l) => ({ depth: l.depth, order: 100, role: l.role, content: l.content })),
    ...absolute,
  ];
  if (authorsNote && authorsNote.content.trim()) {
    queue.push({ depth: authorsNote.depth, order: 100, role: authorsNote.role, content: authorsNote.content });
  }

  // Deepest first → indices into `history` don't shift under us.
  // Within same depth, lower order = inserted first = ends up earlier.
  queue.sort((a, b) => b.depth - a.depth || a.order - b.order);

  for (const inj of queue) {
    const idx = Math.max(0, history.length - inj.depth);
    history.splice(idx, 0, { role: inj.role, content: inj.content });
  }
}

// ── Legacy fallback ──────────────────────────────────────────────────────────
// When called without prompts/promptOrder, synthesize a pool from the
// defaults + any per-call overrides. Lets the existing test suite and the
// not-yet-updated chat orchestrator keep working.

function legacyPrompts(ctx: BuildContext): PromptDefinition[] {
  return DEFAULT_PROMPTS.map((p) => {
    if (p.identifier === 'main' && ctx.systemPromptTemplate) {
      return { ...p, content: ctx.systemPromptTemplate, injection_trigger: [] };
    }
    if (p.identifier === 'jailbreak') {
      // Legacy path: jailbreak content came from card.post_history_instructions
      // directly, not from a preset. The override logic above handles the card
      // side; here we just leave content empty so an empty card field → nothing.
      return { ...p, injection_trigger: [] };
    }
    return { ...p, injection_trigger: [] };
  });
}

// ── Macro env ────────────────────────────────────────────────────────────────

function buildMacroEnv(ctx: BuildContext): MacroEnv {
  const visible = ctx.messages.filter((m) => !m.is_hidden);

  // Walk back to find last user / last assistant separately.
  let lastUser = '';
  let lastChar = '';
  for (let i = visible.length - 1; i >= 0; i--) {
    const m = visible[i]!;
    if (!lastUser && m.role === 'user') lastUser = m.content;
    if (!lastChar && m.role === 'assistant') lastChar = m.content;
    if (lastUser && lastChar) break;
  }

  return {
    user: ctx.persona.name,
    char: ctx.character.name,
    persona: ctx.persona.description,
    description: ctx.character.description,
    personality: ctx.character.personality,
    scenario: ctx.metadata.scenario ?? ctx.character.scenario,
    model: '',  // filled by orchestrator
    messageCount: visible.length,
    lastMessage: visible.at(-1)?.content ?? '',
    lastUserMessage: lastUser,
    lastCharMessage: lastChar,
    chatVars: (ctx.metadata.variables as Record<string, string>) ?? {},
    globalVars: {},
    generationType: ctx.generationType,
    chatIdHash: stringHash(ctx.messages[0]?.chat_id ?? ''),
  };
}
