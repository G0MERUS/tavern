import * as api from '../api';
import type { Connection } from '../api/types';
import { settings, persist } from './settings.svelte';
import { toasts } from './toast.svelte';

let list = $state<Connection[]>([]);

const active = $derived(list.find((c) => c.id === settings.connectionId) ?? null);

// Test results per connection so the model combobox stays populated across
// drawer open/close. In-memory only — refreshed on next Test, lost on reload.
// Persisting it means a stale-models-list bug; not worth it.
let modelCache = $state<Record<string, string[]>>({});

export const connections = {
  get list() { return list; },
  get active() { return active; },

  byId(id: string): Connection | undefined {
    return list.find((c) => c.id === id);
  },

  async load(): Promise<void> {
    const { items } = await api.connections.list();
    list = items;
  },

  select(id: string): void {
    settings.connectionId = id;
    persist('connectionId');
    api.connections.activate(id).catch(console.error);
  },

  async create(input: Parameters<typeof api.connections.create>[0]): Promise<Connection> {
    const c = await api.connections.create(input);
    list = [...list, c];
    return c;
  },

  /**
   * Create from a catalog provider id. Server owns the kind+base_url mapping —
   * a generation script tweak (e.g. fixing a base_url) doesn't require a
   * coordinated frontend deploy.
   */
  async fromCatalog(
    providerId: string,
    overrides: { label?: string; api_key?: string; model?: string } = {},
  ): Promise<Connection> {
    const { model, ...body } = overrides;
    let c = await api.connections.fromCatalog({ provider_id: providerId, ...body });
    // Backend's from-catalog picks models[0]. If user picked something else,
    // patch immediately. Two requests but the second is rare and cheap.
    if (model && model !== c.model) {
      c = await api.connections.patch(c.id, { model });
    }
    list = [...list, c];
    return c;
  },

  async patch(id: string, patch: Parameters<typeof api.connections.patch>[1]): Promise<void> {
    const updated = await api.connections.patch(id, patch);
    list = list.map((c) => c.id === id ? updated : c);
  },

  async delete(id: string): Promise<void> {
    await api.connections.delete(id);
    list = list.filter((c) => c.id !== id);
    delete modelCache[id];
    if (settings.connectionId === id) {
      settings.connectionId = null;
      persist('connectionId');
    }
  },

  async test(id: string): Promise<void> {
    const result = await api.connections.test(id);
    if (result.ok) {
      if (result.models) modelCache[id] = result.models;
      toasts.success(`Connected — ${result.models?.length ?? 0} models`);
    } else {
      toasts.error(result.error ?? 'Connection test failed');
    }
  },

  /**
   * Stateless model probe from raw form fields (no saved connection needed).
   * Returns the result so the form can populate its model combobox before Save.
   */
  async probe(
    input: Parameters<typeof api.connections.probe>[0],
  ): Promise<api.TestResult> {
    return api.connections.probe(input);
  },

  modelsFor(id: string): string[] {
    return modelCache[id] ?? [];
  },
};

