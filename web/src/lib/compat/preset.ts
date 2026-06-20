// ─────────────────────────────────────────────────────────────────────────────
// ST preset → TavernA preset. ST presets are flat ~200-key objects (most
// provider-specific noise we drop). The strategy: whitelist what we want,
// rename, namespace into samplers/prompts/templates/behavior. Everything
// unrecognized falls on the floor.
//
// Detection heuristic: has `prompts: array` AND (`prompt_order` OR
// `temp_openai` OR `openai_max_context`).
// ─────────────────────────────────────────────────────────────────────────────

import type {
  PresetParams,
  PromptDefinition,
  PromptOrderBucket,
  GenerationType,
  PresetBehavior,
} from '../api/types';
import {
  DEFAULT_SAMPLERS,
  DEFAULT_TEMPLATES,
  DEFAULT_BEHAVIOR,
} from '../core/preset-defaults';

type Raw = Record<string, unknown>;

const num = (v: unknown, d: number): number => typeof v === 'number' ? v : d;
const bool = (v: unknown, d: boolean): boolean => typeof v === 'boolean' ? v : d;
const str = (v: unknown, d: string): string => typeof v === 'string' ? v : d;

/** Is this an ST preset (vs a lorebook, character, etc)? */
export function isSTPreset(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as Raw;
  return Array.isArray(o['prompts']) && (
    'prompt_order' in o || 'temp_openai' in o || 'openai_max_context' in o
  );
}

export function migrateSTPreset(raw: unknown): PresetParams {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Not an object');
  }
  const o = raw as Raw;

  return {
    samplers: {
      // ST uses *_openai suffix on most; lucid-loom uses bare `temperature`.
      // Try suffixed first, fall back to bare.
      openai_max_context: num(o['openai_max_context'], DEFAULT_SAMPLERS.openai_max_context),
      openai_max_tokens: num(o['openai_max_tokens'], DEFAULT_SAMPLERS.openai_max_tokens),
      max_context_unlocked: bool(o['max_context_unlocked'], DEFAULT_SAMPLERS.max_context_unlocked),
      temperature: num(o['temp_openai'] ?? o['temperature'], DEFAULT_SAMPLERS.temperature),
      top_p: num(o['top_p_openai'] ?? o['top_p'], DEFAULT_SAMPLERS.top_p),
      top_k: num(o['top_k_openai'] ?? o['top_k'], DEFAULT_SAMPLERS.top_k),
      min_p: num(o['min_p_openai'] ?? o['min_p'], DEFAULT_SAMPLERS.min_p),
      top_a: num(o['top_a_openai'] ?? o['top_a'], DEFAULT_SAMPLERS.top_a),
      frequency_penalty: num(o['freq_pen_openai'] ?? o['frequency_penalty'], DEFAULT_SAMPLERS.frequency_penalty),
      presence_penalty: num(o['pres_pen_openai'] ?? o['presence_penalty'], DEFAULT_SAMPLERS.presence_penalty),
      repetition_penalty: num(o['repetition_penalty_openai'] ?? o['repetition_penalty'], DEFAULT_SAMPLERS.repetition_penalty),
      seed: num(o['seed'], DEFAULT_SAMPLERS.seed),
      n: num(o['n'], DEFAULT_SAMPLERS.n),
      stream: bool(o['stream_openai'] ?? o['stream'], DEFAULT_SAMPLERS.stream),
    },

    prompts: migratePrompts(o),
    prompt_order: migrateOrder(o['prompt_order']),

    templates: {
      impersonation_prompt: str(o['impersonation_prompt'], DEFAULT_TEMPLATES.impersonation_prompt),
      continue_nudge_prompt: str(o['continue_nudge_prompt'], DEFAULT_TEMPLATES.continue_nudge_prompt),
      new_chat_prompt: str(o['new_chat_prompt'], DEFAULT_TEMPLATES.new_chat_prompt),
      new_example_chat_prompt: str(o['new_example_chat_prompt'], DEFAULT_TEMPLATES.new_example_chat_prompt),
      wi_format: str(o['wi_format'], DEFAULT_TEMPLATES.wi_format),
      scenario_format: str(o['scenario_format'], DEFAULT_TEMPLATES.scenario_format),
      personality_format: str(o['personality_format'], DEFAULT_TEMPLATES.personality_format),
      send_if_empty: str(o['send_if_empty'], DEFAULT_TEMPLATES.send_if_empty),
      assistant_prefill: str(o['assistant_prefill'], DEFAULT_TEMPLATES.assistant_prefill),
      assistant_impersonation: str(o['assistant_impersonation'], DEFAULT_TEMPLATES.assistant_impersonation),
      // new_group_chat_prompt, group_nudge_prompt: dropped (no groups).
    },

    behavior: {
      names_behavior: namesBehavior(o['names_behavior']),
      continue_postfix: continuePostfix(o['continue_postfix']),
      continue_prefill: bool(o['continue_prefill'], DEFAULT_BEHAVIOR.continue_prefill),
      squash_system_messages: bool(o['squash_system_messages'], DEFAULT_BEHAVIOR.squash_system_messages),
      // ST has provider-specific aliases for the same flag.
      use_sysprompt: bool(o['use_sysprompt'] ?? o['claude_use_sysprompt'] ?? o['use_makersuite_sysprompt'], DEFAULT_BEHAVIOR.use_sysprompt),
      enable_web_search: bool(o['enable_web_search'], DEFAULT_BEHAVIOR.enable_web_search),
      function_calling: bool(o['function_calling'], DEFAULT_BEHAVIOR.function_calling),
      // ST renamed image_inlining → media_inlining at some point.
      image_inlining: bool(o['media_inlining'] ?? o['image_inlining'], DEFAULT_BEHAVIOR.image_inlining),
      show_thoughts: bool(o['show_thoughts'], DEFAULT_BEHAVIOR.show_thoughts),
      reasoning_effort: reasoningEffort(o['reasoning_effort']),
      verbosity: verbosity(o['verbosity']),
      custom_prompt_post_processing: postProcessing(o['custom_prompt_post_processing']),
    },

    extensions: typeof o['extensions'] === 'object' && o['extensions'] !== null
      ? o['extensions'] as Record<string, unknown>
      : undefined,
  };
}

// ── Prompts ──────────────────────────────────────────────────────────────────

function migratePrompts(o: Raw): PromptDefinition[] {
  const out: PromptDefinition[] = [];
  if (Array.isArray(o['prompts'])) {
    for (const p of o['prompts']) {
      out.push(normalizePrompt(p));
    }
  }
  // Pre-prompt-manager legacy: top-level main_prompt/nsfw_prompt/jailbreak_prompt
  // strings. ST's registerPromptManagerMigration moves them into the pool.
  // If the pool already has these identifiers we leave them alone (ST behavior).
  patchLegacyPrompt(out, 'main', o['main_prompt']);
  patchLegacyPrompt(out, 'nsfw', o['nsfw_prompt']);
  patchLegacyPrompt(out, 'jailbreak', o['jailbreak_prompt']);
  return out;
}

function patchLegacyPrompt(pool: PromptDefinition[], id: string, content: unknown): void {
  if (typeof content !== 'string' || !content) return;
  const existing = pool.find((p) => p.identifier === id);
  if (existing) {
    // Pool already has this identifier — only fill if its content is empty.
    if (!existing.content) existing.content = content;
  } else {
    pool.push(normalizePrompt({ identifier: id, name: id, content, system_prompt: true }));
  }
}

const VALID_TRIGGERS: GenerationType[] = ['normal', 'continue', 'impersonate', 'swipe', 'regenerate', 'quiet'];

function normalizePrompt(raw: unknown): PromptDefinition {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Raw;
  const role = p['role'];
  const triggers = Array.isArray(p['injection_trigger'])
    ? p['injection_trigger'].filter((t): t is GenerationType => VALID_TRIGGERS.includes(t as GenerationType))
    : [];
  // injection_position can be 0/1 numbers or 'relative'/'absolute' strings in
  // some old exports. Coerce.
  let pos = p['injection_position'];
  if (pos === 'absolute') pos = 1;
  else if (pos === 'relative') pos = 0;

  return {
    identifier: str(p['identifier'], crypto.randomUUID()),
    name: str(p['name'], ''),
    role: role === 'user' || role === 'assistant' ? role : 'system',
    content: str(p['content'], ''),
    system_prompt: bool(p['system_prompt'], false),
    marker: bool(p['marker'], false),
    injection_position: pos === 1 ? 1 : 0,
    injection_depth: num(p['injection_depth'], 4),
    injection_order: num(p['injection_order'], 100),
    injection_trigger: triggers,
    forbid_overrides: bool(p['forbid_overrides'], false),
  };
}

// ── Order ────────────────────────────────────────────────────────────────────
// Per-character order is OUT. We renumber whatever we keep to 100000.
//
// ST stores 100000 = unedited default, 100001 = dummy/active. In the wild
// (lucid-loom: 11-entry stub at 100000, 326-entry real arrangement at 100001)
// the larger bucket is the one users actually built. Pick by size.
//
// character_id can be number or string depending on ST version — serialize
// inconsistency. Compare loosely.

function migrateOrder(raw: unknown): PromptOrderBucket[] {
  if (!Array.isArray(raw)) return [];
  const buckets = raw.filter((b): b is Raw => typeof b === 'object' && b !== null);
  if (buckets.length === 0) return [];

  // Pick the bucket with the most entries. The default-order stub at 100000
  // loses to the user-arranged 100001 every time.
  let best: Raw | undefined;
  let bestLen = -1;
  for (const b of buckets) {
    const len = Array.isArray(b['order']) ? b['order'].length : 0;
    if (len > bestLen) { best = b; bestLen = len; }
  }
  if (!best || !Array.isArray(best['order'])) return [];

  const order = best['order']
    .filter((e): e is Raw => typeof e === 'object' && e !== null)
    .map((e) => ({
      identifier: str(e['identifier'], ''),
      enabled: bool(e['enabled'], true),
    }))
    .filter((e) => e.identifier);

  return [{ character_id: 100000, order }];
}

// ── Behavior coercion ────────────────────────────────────────────────────────

function namesBehavior(v: unknown): PresetBehavior['names_behavior'] {
  if (v === -1 || v === 0 || v === 1 || v === 2) return v;
  return DEFAULT_BEHAVIOR.names_behavior;
}

/** ST stores both numeric enum AND string literals across versions. */
function continuePostfix(v: unknown): PresetBehavior['continue_postfix'] {
  if (v === 0 || v === 1 || v === 2 || v === 3) return v;
  if (v === '') return 0;
  if (v === ' ') return 1;
  if (v === '\n') return 2;
  if (v === '\n\n') return 3;
  return DEFAULT_BEHAVIOR.continue_postfix;
}

function reasoningEffort(v: unknown): PresetBehavior['reasoning_effort'] {
  if (v === 'auto' || v === 'min' || v === 'low' || v === 'medium' || v === 'high' || v === 'max') return v;
  return DEFAULT_BEHAVIOR.reasoning_effort;
}

function verbosity(v: unknown): PresetBehavior['verbosity'] {
  if (v === 'auto' || v === 'low' || v === 'medium' || v === 'high') return v;
  return DEFAULT_BEHAVIOR.verbosity;
}

/** Strip _tools suffix (we don't have tool calls yet). */
function postProcessing(v: unknown): PresetBehavior['custom_prompt_post_processing'] {
  if (typeof v !== 'string') return DEFAULT_BEHAVIOR.custom_prompt_post_processing;
  const stripped = v.replace(/_tools$/, '');
  if (stripped === 'merge' || stripped === 'semi' || stripped === 'strict' || stripped === 'single') return stripped;
  return '';
}
