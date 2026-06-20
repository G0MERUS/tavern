// ─────────────────────────────────────────────────────────────────────────────
// Wire types. Mirror the backend's actual REST API (real verbs, opaque IDs in
// path, JSON columns parsed). The frontend plan was written against the legacy
// POST-everything API; this is what the backend actually serves.
// ─────────────────────────────────────────────────────────────────────────────

export interface CharacterSummary {
  id: string;
  name: string;
  avatar_url: string | null;
  thumbnail_url: string | null;
  fav: boolean;
  tags: string[];
  creator: string;
  last_chat_at: number | null;
  chat_count: number;
  created_at: number;
  updated_at: number;
}

/** ST per-character author's-note. Lives under extensions, depth-spliced into chat. */
export interface DepthPrompt {
  prompt: string;
  depth: number;
  role: 'system' | 'user' | 'assistant';
}

/** CardData.extensions — typed view of the keys we read. The index sig keeps
    pass-through for chub/risuai/etc; normalize.ts doesn't change. */
export interface CardExtensions {
  depth_prompt?: DepthPrompt;
  fav?: boolean;
  world?: string;
  /** Group-chat field. Round-tripped, not displayed. */
  talkativeness?: number;
  [key: string]: unknown;
}

/** V2 card data — the spec format. */
export interface CardData {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creator_notes: string;
  system_prompt: string;
  post_history_instructions: string;
  alternate_greetings: string[];
  tags: string[];
  creator: string;
  character_version: string;
  extensions: CardExtensions;
}

export interface Character extends CharacterSummary {
  data: CardData;
  lorebook_ids: string[];
}

export interface Persona {
  id: string;
  name: string;
  description: string;
  avatar_url: string | null;
  thumbnail_url: string | null;
  is_default: boolean;
  created_at: number;
}

export interface ChatSummary {
  id: string;
  title: string;
  character_id: string | null;
  group_id: string | null;
  message_count: number;
  last_message_preview: string;
  created_at: number;
  updated_at: number;
}

export interface Chat {
  id: string;
  title: string;
  character_id: string | null;
  group_id: string | null;
  persona_id: string | null;
  metadata: ChatMetadata;
  created_at: number;
  updated_at: number;
}

/** chat.metadata is freeform JSON; this is what we use of it. */
export interface ChatMetadata {
  /** Set by the backend on POST /:id/branch. */
  parent_chat?: string;
  /** Author's note text. */
  note_prompt?: string;
  note_depth?: number;
  note_role?: 'system' | 'user' | 'assistant';
  note_interval?: number;
  /** {{getvar}} storage scoped to this chat. */
  variables?: Record<string, string>;
  /** Per-chat scenario override. */
  scenario?: string;
  /** Set true after first generation. */
  tainted?: boolean;
  /** Stable hash for {{pick}} seeding. */
  chat_id_hash?: number;
  [key: string]: unknown;
}

export interface Swipe {
  content: string;
  model?: string;
  gen_at?: number;
  /** Per-swipe snapshot of gen-result fields (reasoning, tokens, timing).
      Restored over message.extra on swipe nav. Message-level fields
      (bookmark_link, attachments) live on the message and don't go here. */
  extra?: MessageExtra;
}

export interface MessageExtra {
  model?: string;
  token_count?: number;
  finish_reason?: string;
  gen_started_at?: number;
  gen_finished_at?: number;
  reasoning?: string;
  reasoning_duration?: number;
  time_to_first_token?: number;
  attachments?: string[];
  /** Chat ID this message branched into (the checkpoint flag in the header). */
  bookmark_link?: string;
  [key: string]: unknown;
}

export interface Message {
  id: string;
  chat_id: string;
  position: number;
  role: 'user' | 'assistant' | 'system';
  character_id: string | null;
  content: string;
  swipes: Swipe[];
  swipe_idx: number;
  extra: MessageExtra;
  is_hidden: boolean;
  created_at: number;
}

export type ConnectionKind = 'openai' | 'anthropic' | 'google';

export interface Connection {
  id: string;
  label: string;
  kind: ConnectionKind;
  base_url: string;
  api_key: string;
  model: string;
  extra_headers: string;  // stringified JSON in DB; parse on use
  extra_body: string;
  is_active: number;
  created_at: number;
}

// ── Provider catalog ─────────────────────────────────────────────────────────
// Mirrors src/llm/catalog.generated.ts. Static, served at /api/catalog. Form
// pre-fill data, not an allowlist — a 6-month-old install just types the new
// model id by hand.
// ─────────────────────────────────────────────────────────────────────────────

export interface CatalogModel {
  id: string;
  name: string;
  ctx: number;
  out: number;
  reasoning: boolean;
  vision: boolean;
  cost?: [number, number];
  release?: string;
}

export interface CatalogProvider {
  id: string;
  name: string;
  kind: ConnectionKind;
  base_url: string;
  key_header?: string;
  models: CatalogModel[];
}

export interface Preset {
  id: string;
  name: string;
  params: string;  // stringified JSON
  created_at: number;
  updated_at: number;
}

// ── Themes ───────────────────────────────────────────────────────────────────────
// Same physical schema as presets. The structure is a frontend concern —
// backend stores opaque JSON, doesn't validate ThemeData.
// ─────────────────────────────────────────────────────────────────────────────────

export interface Theme {
  id: string;
  name: string;
  data: string;       // stringified JSON ThemeData
  is_bundled: number; // 1 = seeded, can't DELETE
  created_at: number;
  updated_at: number;
}

export interface ThemeData {
  colors: ThemeColors;
  layout: ThemeLayout;
  toggles: ThemeToggles;
  custom_css: string;
}

/** All rgba() strings. The store doesn't validate — the CSS engine does. */
export interface ThemeColors {
  body: string;            // --SmartThemeBodyColor
  emphasis: string;        // --SmartThemeEmColor
  underline: string;       // --SmartThemeUnderlineColor
  quote: string;           // --SmartThemeQuoteColor
  shadow: string;          // --SmartThemeShadowColor
  blurTint: string;        // --SmartThemeBlurTintColor
  chatTint: string;        // --SmartThemeChatTintColor
  border: string;          // --SmartThemeBorderColor
  userMesBlurTint: string; // --SmartThemeUserMesBlurTintColor
  botMesBlurTint: string;  // --SmartThemeBotMesBlurTintColor
}

export type AvatarStyle = 'circle' | 'square' | 'rounded' | 'rectangle';
export type ChatDisplay = 'flat' | 'bubbles' | 'document';

export interface ThemeLayout {
  font_scale: number;        // 0.5–1.5    → --fontScale
  blur_strength: number;     // 0–30       → --blurStrength
  shadow_width: number;      // 0–5        → --shadowWidth
  chat_width: number;        // 25–100 vw  → --sheldWidth
  /** Panel/popup/button corner radius. 0 = brutalist, 20 = macOS. */
  corner_radius: number;     // 0–20 px    → --panelRadius
  /** Vertical rhythm multiplier on .mes. 0.7 = compact, 1.3 = airy. */
  message_density: number;   // 0.7–1.3    → --mesDensity
  avatar_style: AvatarStyle;
  chat_display: ChatDisplay;
  /** Empty = Noto Sans default. Anything else → font-family on body. */
  font: string;
}

export interface ThemeToggles {
  // ── Body-class toggles (cascade in theme.svelte.ts $effect) ───────────
  reduced_motion: boolean;     // body.reduced-motion → --animation-duration: 0
  no_blur: boolean;            // body.no-blur → backdrop-filter: unset !important
  no_shadows: boolean;         // body.no-shadows → --shadowWidth: 0
  compact_input: boolean;      // body.compact-input → SendForm height shrinks

  // ── Component reads (Message.svelte $derived) ─────────────────────────
  timestamps: boolean;
  model_icon: boolean;         // show message.extra.model in header
  message_ids: boolean;        // sequential index
  token_count: boolean;        // estimateTokens(content) per bubble
  gen_timer: boolean;          // gen_finished - gen_started, last bot mes only
  hide_avatars: boolean;
  expand_actions: boolean;     // hover actions always visible vs group-hover
  swipe_count_all: boolean;    // show 1/N footer on every mes, not just last
}

// ── Preset params ────────────────────────────────────────────────────────────
// preset.params parsed. Backend stores this as opaque JSON — the structure is
// entirely a frontend concern. ST presets are flat ~200-key objects; we
// namespace into samplers/prompts/templates/behavior. The compat migrator
// (compat/preset.ts) handles the flat→namespaced lift on import.
// ─────────────────────────────────────────────────────────────────────────────

export interface PresetParams {
  samplers: SamplerSettings;
  prompts: PromptDefinition[];
  prompt_order: PromptOrderBucket[];
  templates: PresetTemplates;
  behavior: PresetBehavior;
  /** Open-ended for forward compat. Compat migrator dumps unrecognized keys here. */
  extensions?: Record<string, unknown>;
}

export interface SamplerSettings {
  openai_max_context: number;
  openai_max_tokens: number;
  /** Raises context slider max from 8K to 2M. */
  max_context_unlocked: boolean;
  temperature: number;
  top_p: number;
  /** 0 = off */
  top_k: number;
  min_p: number;
  top_a: number;
  frequency_penalty: number;
  presence_penalty: number;
  /** 1 = off */
  repetition_penalty: number;
  /** -1 = random */
  seed: number;
  /** Multi-swipe count. */
  n: number;
  stream: boolean;
}

export type GenerationType = 'normal' | 'continue' | 'swipe' | 'regenerate' | 'impersonate' | 'quiet';

export interface PromptDefinition {
  /** uuid for user prompts, reserved name for system prompts (main/jailbreak/etc). */
  identifier: string;
  name: string;
  role: 'system' | 'user' | 'assistant';
  /** Empty for markers — they pull content at gen time. */
  content: string;
  /** Built-in prompt. Can't delete from pool. */
  system_prompt: boolean;
  /** Filled at gen time (chatHistory, charDescription, etc). */
  marker: boolean;
  /** 0 = RELATIVE (position in order list), 1 = ABSOLUTE (depth-spliced into chat). */
  injection_position: 0 | 1;
  /** When ABSOLUTE: how many messages from end to splice at. */
  injection_depth: number;
  /** Tiebreak when multiple absolute injections share a depth. Default 100. */
  injection_order: number;
  /** Empty = fires on all generation types. */
  injection_trigger: GenerationType[];
  /** Char card can't override (main/jailbreak only). */
  forbid_overrides: boolean;
}

export interface PromptOrderBucket {
  /** 100000 = global. We only ever use global; per-char ordering is dropped on import. */
  character_id: number;
  order: { identifier: string; enabled: boolean }[];
}

export interface PresetTemplates {
  impersonation_prompt: string;
  continue_nudge_prompt: string;
  new_chat_prompt: string;
  new_example_chat_prompt: string;
  /** {0} is the placeholder. ST inconsistency: WI uses {0}, others use macro syntax. */
  wi_format: string;
  scenario_format: string;
  personality_format: string;
  /** Sent in place of an empty user message. */
  send_if_empty: string;
  assistant_prefill: string;
  assistant_impersonation: string;
}

export interface PresetBehavior {
  /** -1=None 0=Default 1=CompletionObject 2=MessageContent */
  names_behavior: -1 | 0 | 1 | 2;
  /** 0=None 1=Space 2=Newline 3=DoubleNewline */
  continue_postfix: 0 | 1 | 2 | 3;
  /** Continue sends last as assistant role instead of system instruction. */
  continue_prefill: boolean;
  /** Merge consecutive system messages (excluding example dialogues). */
  squash_system_messages: boolean;
  /** false = prepend system prompt as user message instead. */
  use_sysprompt: boolean;
  enable_web_search: boolean;
  function_calling: boolean;
  image_inlining: boolean;
  /** Display reasoning blocks. */
  show_thoughts: boolean;
  reasoning_effort: 'auto' | 'min' | 'low' | 'medium' | 'high' | 'max';
  verbosity: 'auto' | 'low' | 'medium' | 'high';
  /** '' = none. _tools variants stripped on import. */
  custom_prompt_post_processing: '' | 'merge' | 'semi' | 'strict' | 'single';
}

export interface Lorebook {
  id: string;
  name: string;
  description: string;
  scan_depth: number;
  token_budget: number;
  recursive: boolean;
  source: string | null;
  created_at: number;
  updated_at: number;
}

export interface LorebookEntry {
  id: string;
  lorebook_id: string;
  keys: string[];
  secondary_keys: string[];
  content: string;
  comment: string;
  enabled: boolean;
  constant: boolean;
  selective: boolean;
  case_sensitive: boolean;
  position: 'before_char' | 'after_char' | 'at_depth';
  depth: number | null;
  insertion_order: number;
  priority: number;
  extensions: Record<string, unknown>;
}

export interface Background {
  filename: string;
  url: string;
  thumbnail_url: string;
}

/** OAI chat-completions message — the wire format we send to /api/generate. */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
  name?: string;
}

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: string } };

/** Backend's normalized SSE frame. */
export interface StreamDelta {
  content?: string;
  reasoning?: string;
  finish_reason?: string | null;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}
