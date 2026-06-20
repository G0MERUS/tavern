// ─────────────────────────────────────────────────────────────────────────────
// Provider catalog. Fetch-once, read-only — the catalog never changes during
// a session. ~70KB → ~12KB gzipped, sub-100ms even on a phone. No loading
// state in consumers: the form just shows an empty provider combobox until
// it's there, which in practice is "before the user opens the drawer."
// ─────────────────────────────────────────────────────────────────────────────

import * as api from '../api';
import type { CatalogProvider } from '../api/types';

let providers = $state<CatalogProvider[]>([]);
let loaded = $state(false);

export const catalog = {
  get providers() { return providers; },
  get loaded() { return loaded; },

  async load(): Promise<void> {
    if (loaded) return;
    const { providers: p } = await api.catalog.get();
    providers = p;
    loaded = true;
  },

  byId(id: string): CatalogProvider | undefined {
    return providers.find((p) => p.id === id);
  },
};
