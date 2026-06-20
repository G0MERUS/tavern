/** V2 character card spec — the wire format for the entire ecosystem. */
export interface TavernCardV2 {
  spec: 'chara_card_v2';
  spec_version: '2.0';
  data: TavernCardV2Data;
}

export interface TavernCardV2Data {
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
  character_book?: CharacterBook;
  tags: string[];
  creator: string;
  character_version: string;
  extensions: Record<string, unknown>;
}

export interface CharacterBook {
  name?: string;
  description?: string;
  scan_depth?: number;
  token_budget?: number;
  recursive_scanning?: boolean;
  extensions: Record<string, unknown>;
  entries: CharacterBookEntry[];
}

export interface CharacterBookEntry {
  keys: string[];
  content: string;
  extensions: Record<string, unknown>;
  enabled: boolean;
  insertion_order: number;
  case_sensitive?: boolean;
  name?: string;
  priority?: number;
  id?: number;
  comment?: string;
  selective?: boolean;
  secondary_keys?: string[];
  constant?: boolean;
  position?: 'before_char' | 'after_char';
}

// DB rows. SQLite returns INTEGER columns as number, TEXT as string. JSON
// columns are stored stringified; the core layer parses them.

export interface CharacterRow {
  id: string;
  name: string;
  data: string;
  avatar_blob: string | null;
  fav: number;
  created_at: number;
  updated_at: number;
  last_chat_at: number | null;
}

export interface PersonaRow {
  id: string;
  name: string;
  description: string;
  avatar_blob: string | null;
  is_default: number;
  created_at: number;
}

export interface ChatRow {
  id: string;
  title: string;
  character_id: string | null;
  group_id: string | null;
  persona_id: string | null;
  metadata: string;
  created_at: number;
  updated_at: number;
}

export interface MessageRow {
  id: string;
  chat_id: string;
  position: number;
  role: 'user' | 'assistant' | 'system';
  character_id: string | null;
  content: string;
  swipes: string;
  swipe_idx: number;
  extra: string;
  is_hidden: number;
  created_at: number;
}

export interface GroupRow {
  id: string;
  name: string;
  avatar_blob: string | null;
  activation_strategy: number;
  generation_mode: number;
  allow_self_response: number;
  auto_mode_delay: number;
  metadata: string;
  fav: number;
  created_at: number;
  updated_at: number;
}

export interface GroupMemberRow {
  group_id: string;
  character_id: string;
  position: number;
  enabled: number;
}

export interface LorebookRow {
  id: string;
  name: string;
  description: string;
  scan_depth: number;
  token_budget: number;
  recursive: number;
  source: string | null;
  created_at: number;
  updated_at: number;
}

export interface LorebookEntryRow {
  id: string;
  lorebook_id: string;
  keys: string;
  secondary_keys: string;
  content: string;
  comment: string;
  enabled: number;
  constant: number;
  selective: number;
  case_sensitive: number;
  position: 'before_char' | 'after_char' | 'at_depth';
  depth: number | null;
  insertion_order: number;
  priority: number;
  extensions: string;
}

export type ConnectionKind = 'openai' | 'anthropic' | 'google';

export interface ConnectionRow {
  id: string;
  label: string;
  kind: ConnectionKind;
  base_url: string;
  api_key: string;
  model: string;
  extra_headers: string;
  extra_body: string;
  is_active: number;
  created_at: number;
}

export interface PresetRow {
  id: string;
  name: string;
  params: string;
  created_at: number;
  updated_at: number;
}

export interface ThemeRow {
  id: string;
  name: string;
  data: string;
  is_bundled: number;
  created_at: number;
  updated_at: number;
}

export interface TagRow {
  id: string;
  name: string;
  color: string | null;
  created_at: number;
}

// API response shapes (parsed JSON columns).

export interface Swipe {
  content: string;
  model?: string;
  gen_at?: number;
  extra?: MessageExtra;
}

export interface MessageExtra {
  model?: string;
  token_count?: number;
  finish_reason?: string;
  gen_started_at?: number;
  gen_finished_at?: number;
  attachments?: string[];
  reasoning?: string;
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

/** OAI chat-completions request shape. We pass through; the upstream validates. */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
  name?: string;
}

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: string } };

/** Domain error with a stable code for the API envelope. */
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 400,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const NotFound = (what: string) =>
  new AppError('NOT_FOUND', `${what} not found`, 404);
