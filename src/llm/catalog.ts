import { CATALOG, type CatalogProvider, type CatalogModel } from './catalog.generated.ts';

// Read-only access to the build-time provider catalog. Static form-prefill
// data; not an allowlist, not user-editable.

const byId = new Map(CATALOG.map((p) => [p.id, p]));

export function getCatalog(): readonly CatalogProvider[] {
  return CATALOG;
}

export function getProvider(id: string): CatalogProvider | undefined {
  return byId.get(id);
}

export function findModel(providerId: string, modelId: string): CatalogModel | undefined {
  return byId.get(providerId)?.models.find((m) => m.id === modelId);
}

export type { CatalogProvider, CatalogModel };
