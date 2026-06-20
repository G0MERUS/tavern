import * as api from '../api';
import type { Persona } from '../api/types';
import { settings, persist } from './settings.svelte';

let list = $state<Persona[]>([]);

const active = $derived(
  list.find((p) => p.id === settings.personaId) ?? list.find((p) => p.is_default) ?? list[0] ?? null,
);

export const personas = {
  get list() { return list; },
  get active() { return active; },

  async load(): Promise<void> {
    const { items } = await api.personas.list();
    list = items;
  },

  select(id: string): void {
    settings.personaId = id;
    persist('personaId');
  },

  async create(input: Parameters<typeof api.personas.create>[0]): Promise<Persona> {
    const p = await api.personas.create(input);
    list = [...list, p];
    return p;
  },

  async patch(id: string, patch: Parameters<typeof api.personas.patch>[1]): Promise<void> {
    const updated = await api.personas.patch(id, patch);
    list = list.map((p) => p.id === id ? updated : p);
  },

  async delete(id: string): Promise<void> {
    await api.personas.delete(id);
    list = list.filter((p) => p.id !== id);
    if (settings.personaId === id) {
      settings.personaId = null;
      persist('personaId');
    }
  },
};
