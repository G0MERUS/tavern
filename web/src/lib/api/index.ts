// ─────────────────────────────────────────────────────────────────────────────
// One thin module per resource. Composition by re-export, not by inheritance —
// each module is a bag of functions over `http`. No client class, no base.
// ─────────────────────────────────────────────────────────────────────────────

import { http } from './http';
import type * as T from './types';

export * from './types';
export { ApiError } from './http';
export { generateStream, parseSSE } from './generate';

// ── Settings (server K/V) ────────────────────────────────────────────────────
export const settings = {
  get: () => http.get<Record<string, unknown>>('/api/settings'),
  patch: (patch: Record<string, unknown>) =>
    http.patch<Record<string, unknown>>('/api/settings', patch),
};

// ── Characters ───────────────────────────────────────────────────────────────
export const characters = {
  list: (q?: { sort?: 'name' | 'recent' | 'created'; q?: string; fav?: boolean }) => {
    const params = new URLSearchParams();
    if (q?.sort) params.set('sort', q.sort);
    if (q?.q) params.set('q', q.q);
    if (q?.fav) params.set('fav', '1');
    return http.get<{ items: T.CharacterSummary[]; total: number }>(`/api/characters?${params}`);
  },
  get: (id: string) => http.get<T.Character>(`/api/characters/${id}`),
  create: (data: Partial<T.CardData>, avatar?: File) => {
    const form = new FormData();
    form.set('data', JSON.stringify(data));
    if (avatar) form.set('avatar', avatar);
    return http.postForm<T.Character>('/api/characters', form);
  },
  patch: (id: string, patch: { data?: Partial<T.CardData>; fav?: boolean }) =>
    http.patch<T.Character>(`/api/characters/${id}`, patch),
  delete: (id: string) => http.delete<{}>(`/api/characters/${id}`),
  duplicate: (id: string) => http.post<T.Character>(`/api/characters/${id}/duplicate`),
  import: (file: File) => {
    const form = new FormData();
    form.set('file', file);
    return http.postForm<T.Character>('/api/characters/import', form);
  },
  importUrl: (url: string) =>
    http.post<T.Character>('/api/characters/import', { url }),
  exportUrl: (id: string, format: 'png' | 'json' = 'png') =>
    `/api/characters/${id}/export?format=${format}`,
};

// ── Personas ─────────────────────────────────────────────────────────────────
export const personas = {
  list: () => http.get<{ items: T.Persona[] }>('/api/personas'),
  get: (id: string) => http.get<T.Persona>(`/api/personas/${id}`),
  create: (input: { name: string; description?: string; avatar?: File }) => {
    const form = new FormData();
    form.set('name', input.name);
    if (input.description) form.set('description', input.description);
    if (input.avatar) form.set('avatar', input.avatar);
    return http.postForm<T.Persona>('/api/personas', form);
  },
  patch: (id: string, patch: { name?: string; description?: string; is_default?: boolean }) =>
    http.patch<T.Persona>(`/api/personas/${id}`, patch),
  delete: (id: string) => http.delete<{}>(`/api/personas/${id}`),
};

// ── Chats ────────────────────────────────────────────────────────────────────
export const chats = {
  list: (q?: { character_id?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (q?.character_id) params.set('character_id', q.character_id);
    if (q?.limit) params.set('limit', String(q.limit));
    return http.get<{ items: T.ChatSummary[] }>(`/api/chats?${params}`);
  },
  /** Returns chat + all messages (or paginated via after_position). */
  get: (id: string, q?: { after_position?: number; limit?: number }) => {
    const params = new URLSearchParams();
    if (q?.after_position !== undefined) params.set('after_position', String(q.after_position));
    if (q?.limit) params.set('limit', String(q.limit));
    return http.get<{ chat: T.Chat; messages: T.Message[] }>(`/api/chats/${id}?${params}`);
  },
  create: (input: { character_id?: string; group_id?: string; title?: string; persona_id?: string }) =>
    http.post<T.Chat>('/api/chats', input),
  patch: (id: string, patch: { title?: string; metadata?: T.ChatMetadata; persona_id?: string | null }) =>
    http.patch<T.Chat>(`/api/chats/${id}`, patch),
  delete: (id: string) => http.delete<{}>(`/api/chats/${id}`),
  /** Copies messages WHERE position <= up_to_position into a new chat with
      metadata.parent_chat set. Checkpoint vs branch is a frontend distinction. */
  branch: (chatId: string, body: { up_to_position: number; title?: string }) =>
    http.post<T.Chat>(`/api/chats/${chatId}/branch`, body),
};

// ── Messages ─────────────────────────────────────────────────────────────────
export const messages = {
  create: (
    chatId: string,
    input: {
      role: 'user' | 'assistant' | 'system';
      content: string;
      character_id?: string | null;
      extra?: T.MessageExtra;
      is_hidden?: boolean;
      /** Insert immediately after this position (mid-chat insert). */
      after_position?: number;
    },
  ) => http.post<T.Message>(`/api/chats/${chatId}/messages`, input),

  patch: (
    id: string,
    patch: { content?: string; extra?: T.MessageExtra; is_hidden?: boolean; swipe_idx?: number },
  ) => http.patch<T.Message>(`/api/messages/${id}`, patch),

  delete: (id: string) => http.delete<{}>(`/api/messages/${id}`),

  /** Swap positions with another message. Returns the moved message. */
  move: (id: string, body: { swap_with: string }) =>
    http.post<T.Message>(`/api/messages/${id}/move`, body),

  addSwipe: (id: string, swipe: { content: string; model?: string; extra?: T.MessageExtra; activate?: boolean }) =>
    http.post<T.Message>(`/api/messages/${id}/swipe`, swipe),

  /** Drop swipes[idx]. Backend clamps swipe_idx and restores content. */
  deleteSwipe: (id: string, idx: number) =>
    http.delete<T.Message>(`/api/messages/${id}/swipes/${idx}`),
};

// ── Connections ──────────────────────────────────────────────────────────────
export interface TestResult {
  ok: boolean;
  models?: string[];
  error?: string;
}

export const connections = {
  list: () => http.get<{ items: T.Connection[] }>('/api/connections'),
  get: (id: string) => http.get<T.Connection>(`/api/connections/${id}`),
  create: (input: {
    label: string;
    kind?: T.ConnectionKind;
    base_url: string;
    api_key?: string;
    model: string;
    extra_headers?: Record<string, string>;
    extra_body?: Record<string, unknown>;
  }) => http.post<T.Connection>('/api/connections', input),
  /** Server owns the catalog→connection mapping (kind + base_url). */
  fromCatalog: (input: { provider_id: string; label?: string; api_key?: string }) =>
    http.post<T.Connection>('/api/connections/from-catalog', input),
  patch: (id: string, patch: Partial<{
    label: string;
    kind: T.ConnectionKind;
    base_url: string;
    api_key: string;
    model: string;
    extra_headers: Record<string, string>;
    extra_body: Record<string, unknown>;
  }>) => http.patch<T.Connection>(`/api/connections/${id}`, patch),
  delete: (id: string) => http.delete<{}>(`/api/connections/${id}`),
  activate: (id: string) => http.post<T.Connection>(`/api/connections/${id}/activate`),
  test: (id: string) => http.post<TestResult>(`/api/connections/${id}/test`),
};

// ── Provider catalog ─────────────────────────────────────────────────────────
export const catalog = {
  get: () => http.get<{ providers: T.CatalogProvider[] }>('/api/catalog'),
};

// ── Presets ──────────────────────────────────────────────────────────────────
export const presets = {
  list: () => http.get<{ items: T.Preset[] }>('/api/presets'),
  get: (id: string) => http.get<T.Preset>(`/api/presets/${id}`),
  create: (name: string, params: T.PresetParams) =>
    http.post<T.Preset>('/api/presets', { name, params }),
  patch: (id: string, patch: { name?: string; params?: T.PresetParams }) =>
    http.patch<T.Preset>(`/api/presets/${id}`, patch),
  delete: (id: string) => http.delete<{}>(`/api/presets/${id}`),
};

// ── Themes ───────────────────────────────────────────────────────────────────────
export const themes = {
  list: () => http.get<{ items: T.Theme[] }>('/api/themes'),
  get: (id: string) => http.get<T.Theme>(`/api/themes/${id}`),
  create: (body: { name: string; data: T.ThemeData }) =>
    http.post<T.Theme>('/api/themes', body),
  patch: (id: string, body: { name?: string; data?: T.ThemeData }) =>
    http.patch<T.Theme>(`/api/themes/${id}`, body),
  delete: (id: string) => http.delete<{}>(`/api/themes/${id}`),
};

// ── Lorebooks ────────────────────────────────────────────────────────────────
export const lorebooks = {
  list: () => http.get<{ items: T.Lorebook[] }>('/api/lorebooks'),
  get: (id: string) => http.get<T.Lorebook & { entries: T.LorebookEntry[] }>(`/api/lorebooks/${id}`),
  create: (input: { name: string; description?: string; scan_depth?: number; token_budget?: number; recursive?: boolean }) =>
    http.post<T.Lorebook>('/api/lorebooks', input),
  patch: (id: string, patch: Partial<{ name: string; description: string; scan_depth: number; token_budget: number; recursive: boolean }>) =>
    http.patch<T.Lorebook>(`/api/lorebooks/${id}`, patch),
  delete: (id: string) => http.delete<{}>(`/api/lorebooks/${id}`),
  createEntry: (bookId: string, entry: Partial<T.LorebookEntry> & { content: string }) =>
    http.post<T.LorebookEntry>(`/api/lorebooks/${bookId}/entries`, entry),
  patchEntry: (entryId: string, patch: Partial<T.LorebookEntry>) =>
    http.patch<T.LorebookEntry>(`/api/lorebook-entries/${entryId}`, patch),
  deleteEntry: (entryId: string) =>
    http.delete<{}>(`/api/lorebook-entries/${entryId}`),
};

// ── Backgrounds ──────────────────────────────────────────────────────────────
export const backgrounds = {
  list: () => http.get<{ items: T.Background[] }>('/api/backgrounds'),
  upload: (file: File) => {
    const form = new FormData();
    form.set('file', file);
    return http.postForm<T.Background>('/api/backgrounds', form);
  },
  delete: (filename: string) => http.delete<{}>(`/api/backgrounds/${filename}`),
};

// ── Tokenize ─────────────────────────────────────────────────────────────────
export const tokenize = (text: string) =>
  http.post<{ tokens: number }>('/api/tokenize', { text });
