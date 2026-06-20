// ─────────────────────────────────────────────────────────────────────────────
// The 12 reserved prompts + default order. Lifted verbatim from ST
// PromptManager.js lines 1998–2110. These identifiers are load-bearing —
// the prompt builder switches on them to resolve markers, and ST presets in
// the wild reference them.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  PromptDefinition,
  PresetParams,
  SamplerSettings,
  PresetTemplates,
  PresetBehavior,
} from '../api/types';

const base = {
  role: 'system' as const,
  injection_position: 0 as const,
  injection_depth: 4,
  injection_order: 100,
  injection_trigger: [],
  forbid_overrides: false,
};

/** Reserved identifier set for fast lookup. Order/sanitize check membership. */
export const RESERVED_IDS = new Set([
  'main', 'nsfw', 'jailbreak', 'enhanceDefinitions',
  'dialogueExamples', 'chatHistory', 'worldInfoBefore', 'worldInfoAfter',
  'charDescription', 'charPersonality', 'scenario', 'personaDescription',
]);

export const DEFAULT_PROMPTS: PromptDefinition[] = [
  // ── Editable system prompts (system_prompt: true, marker: false) ─────────
  {
    ...base,
    identifier: 'main',
    name: 'Main Prompt',
    content: "Write {{char}}'s next reply in a fictional chat between {{char}} and {{user}}.",
    system_prompt: true,
    marker: false,
  },
  {
    ...base,
    identifier: 'nsfw',
    name: 'Auxiliary Prompt',
    content: '',
    system_prompt: true,
    marker: false,
  },
  {
    ...base,
    identifier: 'jailbreak',
    name: 'Post-History Instructions',
    content: '',
    system_prompt: true,
    marker: false,
  },
  {
    ...base,
    identifier: 'enhanceDefinitions',
    name: 'Enhance Definitions',
    content: "If you have more knowledge of {{char}}, add to the character's lore and personality to enhance them but keep the Character Sheet's definitions absolute.",
    system_prompt: true,
    marker: false,
  },
  // ── Markers (system_prompt: true, marker: true) ──────────────────────────
  // Content is empty; resolved at gen time from BuildContext.
  {
    ...base,
    identifier: 'dialogueExamples',
    name: 'Chat Examples',
    content: '',
    system_prompt: true,
    marker: true,
  },
  {
    ...base,
    identifier: 'chatHistory',
    name: 'Chat History',
    content: '',
    system_prompt: true,
    marker: true,
  },
  {
    ...base,
    identifier: 'worldInfoBefore',
    name: 'World Info (before)',
    content: '',
    system_prompt: true,
    marker: true,
  },
  {
    ...base,
    identifier: 'worldInfoAfter',
    name: 'World Info (after)',
    content: '',
    system_prompt: true,
    marker: true,
  },
  {
    ...base,
    identifier: 'charDescription',
    name: 'Char Description',
    content: '',
    system_prompt: true,
    marker: true,
  },
  {
    ...base,
    identifier: 'charPersonality',
    name: 'Char Personality',
    content: '',
    system_prompt: true,
    marker: true,
  },
  {
    ...base,
    identifier: 'scenario',
    name: 'Scenario',
    content: '',
    system_prompt: true,
    marker: true,
  },
  {
    ...base,
    identifier: 'personaDescription',
    name: 'Persona Description',
    content: '',
    system_prompt: true,
    marker: true,
  },
];

export const DEFAULT_ORDER: { identifier: string; enabled: boolean }[] = [
  { identifier: 'main', enabled: true },
  { identifier: 'worldInfoBefore', enabled: true },
  { identifier: 'personaDescription', enabled: true },
  { identifier: 'charDescription', enabled: true },
  { identifier: 'charPersonality', enabled: true },
  { identifier: 'scenario', enabled: true },
  { identifier: 'enhanceDefinitions', enabled: false },
  { identifier: 'nsfw', enabled: true },
  { identifier: 'worldInfoAfter', enabled: true },
  { identifier: 'dialogueExamples', enabled: true },
  { identifier: 'chatHistory', enabled: true },
  { identifier: 'jailbreak', enabled: true },
];

/**
 * Marker source hints for the editor popup. These are the markers that pull
 * from the character/persona at gen time and whose role/position can be
 * edited (the other markers — chatHistory, dialogueExamples — are structural).
 */
export const PROMPT_SOURCES: Record<string, string> = {
  charDescription: 'Character Description',
  charPersonality: 'Character Personality',
  scenario: 'Character Scenario',
  personaDescription: 'Persona Description',
  worldInfoBefore: 'World Info (↑Char)',
  worldInfoAfter: 'World Info (↓Char)',
};

// ── Permission predicates ────────────────────────────────────────────────────
// Lift from ST PromptManager.js lines 1067–1112. Pure functions over a
// PromptDefinition; the UI gates buttons on these.

/** Hard-delete from pool. System prompts: never. */
export function canDelete(p: PromptDefinition): boolean {
  return !p.system_prompt;
}

/** Open editor. Most markers no, except the 6 with editable role/position. */
export function canEdit(p: PromptDefinition): boolean {
  return !p.marker || p.identifier in PROMPT_SOURCES;
}

/**
 * Toggle enabled. ST has a whitelist that net-effect allows everything in
 * DEFAULT_ORDER. We just allow all.
 */
export function canToggle(_p: PromptDefinition): boolean {
  return true;
}

/** Detach from order list (≠ delete from pool). Same gate as delete. */
export function canDetach(p: PromptDefinition): boolean {
  return !p.system_prompt;
}

/**
 * Show forbid_overrides checkbox. Only main/jailbreak can be overridden by
 * char cards (system_prompt / post_history_instructions fields).
 */
export function canForbidOverride(p: PromptDefinition): boolean {
  return p.identifier === 'main' || p.identifier === 'jailbreak';
}

/** Show reset-to-default button in editor. Editable system prompts only. */
export function canReset(p: PromptDefinition): boolean {
  return p.system_prompt && !p.marker;
}

// ── Default field values ─────────────────────────────────────────────────────

export const DEFAULT_SAMPLERS: SamplerSettings = {
  openai_max_context: 200000,
  openai_max_tokens: 4096,
  max_context_unlocked: false,
  temperature: 1.0,
  top_p: 1.0,
  top_k: 0,
  min_p: 0,
  top_a: 0,
  frequency_penalty: 0,
  presence_penalty: 0,
  repetition_penalty: 1,
  seed: -1,
  n: 1,
  stream: true,
};

export const DEFAULT_TEMPLATES: PresetTemplates = {
  impersonation_prompt: "[Write your next reply from the point of view of {{user}}, using the chat history so far as a guideline for the writing style of {{user}}. Don't write as {{char}} or system. Don't describe actions of {{char}}.]",
  continue_nudge_prompt: '[Continue your last message without repeating its original content.]',
  new_chat_prompt: '[Start a new Chat]',
  new_example_chat_prompt: '[Example Chat]',
  wi_format: '{0}',
  scenario_format: '{{scenario}}',
  personality_format: '{{personality}}',
  send_if_empty: '',
  assistant_prefill: '',
  assistant_impersonation: '',
};

export const DEFAULT_BEHAVIOR: PresetBehavior = {
  names_behavior: 0,
  continue_postfix: 1,
  continue_prefill: false,
  squash_system_messages: false,
  use_sysprompt: true,
  enable_web_search: false,
  function_calling: false,
  image_inlining: true,
  show_thoughts: true,
  reasoning_effort: 'auto',
  verbosity: 'auto',
  custom_prompt_post_processing: '',
};

/** A complete fresh PresetParams. Used by create() and as the parse() fallback. */
export function makeDefaultPreset(): PresetParams {
  return {
    samplers: { ...DEFAULT_SAMPLERS },
    prompts: DEFAULT_PROMPTS.map((p) => ({ ...p, injection_trigger: [] })),
    prompt_order: [{ character_id: 100000, order: DEFAULT_ORDER.map((o) => ({ ...o })) }],
    templates: { ...DEFAULT_TEMPLATES },
    behavior: { ...DEFAULT_BEHAVIOR },
  };
}
