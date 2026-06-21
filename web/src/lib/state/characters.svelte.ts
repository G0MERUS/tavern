// ─────────────────────────────────────────────────────────────────────────────
// Character list + active character. List is summary-only (no `data` field);
// the active one fetches the full card. Composition: this module owns the
// list cache, chat.svelte.ts reads `active` to build prompts.
// ─────────────────────────────────────────────────────────────────────────────

import * as api from '../api';
import type { CharacterSummary, Character, CardData } from '../api/types';
import { debounce } from '../utils/debounce';
import { toasts } from './toast.svelte';

let list = $state<CharacterSummary[]>([]);
let active = $state<Character | null>(null);
let filter = $state({ query: '', favOnly: false, sort: 'recent' as 'name' | 'recent' | 'created' });

/** Filtered + sorted list — derived, recomputes when list or filter change. */
const filtered = $derived.by(() => {
  let out = list;
  if (filter.query) {
    const q = filter.query.toLowerCase();
    out = out.filter((c) => c.name.toLowerCase().includes(q));
  }
  if (filter.favOnly) {
    out = out.filter((c) => c.fav);
  }
  // Server already sorts; client re-sort only matters when filter changes.
  return out;
});

export const characters = {
  get list() { return list; },
  get filtered() { return filtered; },
  get active() { return active; },
  get filter() { return filter; },

  async load(): Promise<void> {
    const { items } = await api.characters.list({ sort: filter.sort });
    list = items;
  },

  async select(id: string): Promise<void> {
    active = await api.characters.get(id);
    // Bump to front of recents — server tracks last_chatted_at.
    const idx = list.findIndex((c) => c.id === id);
    if (idx > 0) list = [list[idx]!, ...list.slice(0, idx), ...list.slice(idx + 1)];
  },

  deselect(): void {
    active = null;
  },

  async create(data: Parameters<typeof api.characters.create>[0], avatar?: File): Promise<Character> {
    const c = await api.characters.create(data, avatar);
    await characters.load();  // server sets defaults we don't know; refetch.
    toasts.success(`Created ${c.name}`);
    return c;
  },

  /**
   * Create a blank character with no avatar (an avatar is optional — you add
   * one later via the edit panel if you want). Selects it so the caller can
   * drop straight into edit mode.
   */
  async createBlank(): Promise<Character> {
    const c = await api.characters.create({ name: 'New Character' });
    await characters.load();
    active = await api.characters.get(c.id);
    toasts.success('Created character');
    return active;
  },


  /**
   * Debounced card patch. Reads `active` at FIRE time, not queue time — if
   * the user switches characters mid-debounce, the stale write is dropped.
   * Lifted from CharacterPanel; CharAdvanced and Greetings also call it.
   */
  saveData: debounce((forId: string, data: CardData) => {
    if (active?.id !== forId) return;
    void characters.patch(forId, { data });
  }, 800),

  async patch(id: string, patch: Parameters<typeof api.characters.patch>[1]): Promise<void> {
    const updated = await api.characters.patch(id, patch);
    // Update list summary in place.
    list = list.map((c) => c.id === id ? { ...c, name: updated.name, fav: updated.fav } : c);
    if (active?.id === id) active = updated;
  },

  async delete(id: string): Promise<void> {
    await api.characters.delete(id);
    list = list.filter((c) => c.id !== id);
    if (active?.id === id) active = null;
  },

  async import(file: File): Promise<void> {
    const c = await api.characters.import(file);
    await characters.load();
    toasts.success(`Imported ${c.name}`);
  },
};
