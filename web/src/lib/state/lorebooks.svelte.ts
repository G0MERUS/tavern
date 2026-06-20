// ─────────────────────────────────────────────────────────────────────────────
// Lorebook collection + entries cache. Books are lazy-loaded: list is light,
// entries fetch on first open. The chat orchestrator pulls active books from
// (settings.globalLorebooks ∪ character.lorebook_ids) at scan time.
// ─────────────────────────────────────────────────────────────────────────────

import * as api from '../api';
import type { Lorebook, LorebookEntry } from '../api/types';
import { debounce } from '../utils/debounce';

let list = $state<Lorebook[]>([]);
/** book_id → entries. Lazy. */
let entriesCache = $state<Record<string, LorebookEntry[]>>({});
/** Currently open in the editor drawer. */
let editingId = $state<string | null>(null);

const editing = $derived.by(() => {
  if (!editingId) return null;
  const book = list.find((b) => b.id === editingId);
  if (!book) return null;
  return { book, entries: entriesCache[editingId] ?? [] };
});

export const lorebooks = {
  get list() { return list; },
  get editing() { return editing; },

  async load(): Promise<void> {
    const { items } = await api.lorebooks.list();
    list = items;
  },

  /** Fetch + cache entries for one book. Returns from cache if already loaded. */
  async loadEntries(bookId: string): Promise<LorebookEntry[]> {
    if (entriesCache[bookId]) return entriesCache[bookId]!;
    const full = await api.lorebooks.get(bookId);
    entriesCache = { ...entriesCache, [bookId]: full.entries };
    return full.entries;
  },

  /** Resolve all entries for a set of book IDs. Used by the scan orchestrator. */
  async resolveEntries(bookIds: string[]): Promise<LorebookEntry[]> {
    const all: LorebookEntry[] = [];
    for (const id of bookIds) {
      all.push(...(await lorebooks.loadEntries(id)));
    }
    return all;
  },

  // ── Editor ────────────────────────────────────────────────────────────────

  async openEditor(bookId: string): Promise<void> {
    await lorebooks.loadEntries(bookId);
    editingId = bookId;
  },

  closeEditor(): void {
    editingId = null;
  },

  // ── CRUD: books ───────────────────────────────────────────────────────────

  async create(name: string): Promise<Lorebook> {
    const book = await api.lorebooks.create({ name });
    list = [...list, book];
    entriesCache = { ...entriesCache, [book.id]: [] };
    return book;
  },

  async patchBook(id: string, patch: Parameters<typeof api.lorebooks.patch>[1]): Promise<void> {
    const updated = await api.lorebooks.patch(id, patch);
    list = list.map((b) => b.id === id ? updated : b);
  },

  async delete(id: string): Promise<void> {
    await api.lorebooks.delete(id);
    list = list.filter((b) => b.id !== id);
    const { [id]: _, ...rest } = entriesCache;
    entriesCache = rest;
    if (editingId === id) editingId = null;
  },

  // ── CRUD: entries ─────────────────────────────────────────────────────────
  // Entry edits are debounced — typing in the keys/content fields shouldn't
  // hammer the server. The PATCH carries the full entry shape.

  async createEntry(bookId: string): Promise<LorebookEntry> {
    const entry = await api.lorebooks.createEntry(bookId, { content: '', keys: [] });
    entriesCache = {
      ...entriesCache,
      [bookId]: [...(entriesCache[bookId] ?? []), entry],
    };
    return entry;
  },

  /** Optimistic local update + debounced server patch. */
  patchEntry(bookId: string, entryId: string, patch: Partial<LorebookEntry>): void {
    const entries = entriesCache[bookId];
    if (!entries) return;
    entriesCache = {
      ...entriesCache,
      [bookId]: entries.map((e) => e.id === entryId ? { ...e, ...patch } : e),
    };
    queueEntrySave(entryId, patch);
  },

  async deleteEntry(bookId: string, entryId: string): Promise<void> {
    await api.lorebooks.deleteEntry(entryId);
    entriesCache = {
      ...entriesCache,
      [bookId]: (entriesCache[bookId] ?? []).filter((e) => e.id !== entryId),
    };
  },
};

// Per-entry debounced save. One timer per entry; rapid edits to entry A don't
// reset entry B's timer. Patches accumulate — typing in `keys` then `content`
// before the timer fires sends both fields in one PATCH.
type EntrySaver = ((p: Partial<LorebookEntry>) => void) & { cancel: () => void };
const pendingEntrySaves = new Map<string, { saver: EntrySaver; acc: Partial<LorebookEntry> }>();

function queueEntrySave(entryId: string, patch: Partial<LorebookEntry>): void {
  let pending = pendingEntrySaves.get(entryId);
  if (!pending) {
    const acc: Partial<LorebookEntry> = {};
    const saver: EntrySaver = debounce(() => {
      api.lorebooks.patchEntry(entryId, acc).catch(console.error);
      pendingEntrySaves.delete(entryId);
    }, 800);
    pending = { saver, acc };
    pendingEntrySaves.set(entryId, pending);
  }
  Object.assign(pending.acc, patch);
  pending.saver(patch);
}
