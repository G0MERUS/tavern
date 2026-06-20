#!/usr/bin/env bun
// Provider catalog generator. Fetches models.dev/api.json, projects it down
// to form-prefill data, writes src/llm/catalog.generated.ts.
//
//   bun scripts/generate-catalog.ts
//
// Cadence: weekly-ish, same as a dependency bump. The output is checked in;
// bundling means zero startup latency and offline operation.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = 'https://models.dev/api.json';
const OUTPUT = join(import.meta.dir, '..', 'src', 'llm', 'catalog.generated.ts');

// Curated cloud providers. models.dev has 110+ but most are inference
// resellers we don't care about. Note: models.dev keys are "togetherai" and
// "moonshotai" (not "together"/"moonshot").
const ALLOWLIST = new Set([
  'anthropic',
  'openai',
  'google',
  'openrouter',
  'deepseek',
  'xai',
  'mistral',
  'groq',
  'togetherai',
  'fireworks-ai',
  'perplexity',
  'moonshotai',
  'cohere',
]);

// models.dev's `api` field is null for providers with bespoke SDKs. These
// don't change. Anthropic/Google point at native endpoints (not OAI shims).
const BASE_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta',
  xai: 'https://api.x.ai/v1',
  groq: 'https://api.groq.com/openai/v1',
  mistral: 'https://api.mistral.ai/v1',
  perplexity: 'https://api.perplexity.ai',
  cohere: 'https://api.cohere.ai/compatibility/v1',
  togetherai: 'https://api.together.xyz/v1',
};

// Display hint shown next to the API key input. Doesn't change request
// shaping (kind does).
const KEY_HEADERS: Record<string, string> = {
  anthropic: 'x-api-key',
  google: 'x-goog-api-key',
  // Everything else: Authorization: Bearer (default, omit).
};

// Local servers have no model list — those are discovered live via the Test
// button → /v1/models. The catalog just supplies the conventional default port.
const LOCAL_PROVIDERS = [
  { id: 'llamacpp', name: 'llama.cpp', base_url: 'http://127.0.0.1:8080/v1' },
  { id: 'ollama', name: 'Ollama', base_url: 'http://127.0.0.1:11434/v1' },
  { id: 'koboldcpp', name: 'KoboldCpp', base_url: 'http://127.0.0.1:5001/v1' },
];

/** Map npm package → wire format. */
function npmToKind(npm: string | undefined): 'openai' | 'anthropic' | 'google' {
  if (!npm) return 'openai';
  if (npm === '@ai-sdk/anthropic' || npm === '@ai-sdk/google-vertex/anthropic') {
    return 'anthropic';
  }
  if (npm === '@ai-sdk/google' || npm === '@ai-sdk/google-vertex') {
    return 'google';
  }
  return 'openai';
}

// Just enough of the models.dev shape to type the projection.
interface MDModel {
  id: string;
  name: string;
  attachment?: boolean;
  reasoning?: boolean;
  release_date?: string;
  cost?: { input?: number; output?: number };
  limit?: { context?: number; output?: number };
}
interface MDProvider {
  id: string;
  name: string;
  npm?: string;
  api?: string | null;
  models: Record<string, MDModel>;
}

// Output shapes mirror src/llm/catalog.generated.ts.
interface CatalogModel {
  id: string;
  name: string;
  ctx: number;
  out: number;
  reasoning: boolean;
  vision: boolean;
  cost?: [number, number];
  release?: string;
}
interface CatalogProvider {
  id: string;
  name: string;
  kind: 'openai' | 'anthropic' | 'google';
  base_url: string;
  key_header?: string;
  models: CatalogModel[];
}

function projectModel(m: MDModel): CatalogModel {
  const out: CatalogModel = {
    id: m.id,
    name: m.name,
    ctx: m.limit?.context ?? 0,
    out: m.limit?.output ?? 0,
    reasoning: m.reasoning ?? false,
    vision: m.attachment ?? false,
  };
  if (m.cost?.input != null && m.cost?.output != null) {
    out.cost = [m.cost.input, m.cost.output];
  }
  if (m.release_date) {
    out.release = m.release_date;
  }
  return out;
}

async function main() {
  console.log(`Fetching ${SOURCE}...`);
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`models.dev fetch failed: ${res.status} ${res.statusText}`);
  const raw = (await res.json()) as Record<string, MDProvider>;

  const providers: CatalogProvider[] = [];

  for (const [id, p] of Object.entries(raw)) {
    if (!ALLOWLIST.has(id)) continue;

    const kind = npmToKind(p.npm);
    const base_url = (p.api ?? BASE_URLS[id] ?? '').replace(/\/+$/, '');
    if (!base_url) {
      console.warn(`  ⚠ ${id}: no base_url known, skipping`);
      continue;
    }

    const models = Object.values(p.models)
      .map(projectModel)
      .sort((a, b) => (b.release ?? '').localeCompare(a.release ?? ''));

    const entry: CatalogProvider = { id, name: p.name, kind, base_url, models };
    if (KEY_HEADERS[id]) entry.key_header = KEY_HEADERS[id];

    providers.push(entry);
    console.log(`  ${id.padEnd(14)} ${kind.padEnd(10)} ${models.length} models`);
  }

  // Cloud providers sort alphabetically by display name.
  providers.sort((a, b) => a.name.localeCompare(b.name));

  // Local servers go last in the picker.
  for (const local of LOCAL_PROVIDERS) {
    providers.push({
      id: local.id,
      name: local.name,
      kind: 'openai',
      base_url: local.base_url,
      models: [],
    });
    console.log(`  ${local.id.padEnd(14)} openai     (local, 0 models)`);
  }

  const totalModels = providers.reduce((n, p) => n + p.models.length, 0);
  const json = JSON.stringify(providers, null, 2);

  const file = `// GENERATED — DO NOT EDIT. Run: bun scripts/generate-catalog.ts
// Source: ${SOURCE}
// Generated: ${new Date().toISOString()}
// Providers: ${providers.length}, Models: ${totalModels}

export interface CatalogModel {
  /** Wire id, e.g. "claude-opus-4-5-20251101" */
  id: string;
  /** Display name, e.g. "Claude Opus 4.5" */
  name: string;
  /** Context window in tokens */
  ctx: number;
  /** Max output tokens */
  out: number;
  /** Has a thinking/reasoning mode */
  reasoning: boolean;
  /** Accepts image input */
  vision: boolean;
  /** [$/Mtok in, $/Mtok out] — absent for free/local */
  cost?: [number, number];
  /** YYYY-MM-DD — for sorting newest-first */
  release?: string;
}

export interface CatalogProvider {
  /** "anthropic", "openrouter", "llamacpp" */
  id: string;
  /** "Anthropic" */
  name: string;
  /** Wire format discriminator — drives request shaping in generate.ts */
  kind: 'openai' | 'anthropic' | 'google';
  /** Pre-fill value for the connection form */
  base_url: string;
  /** Display hint shown next to the API key input ("x-api-key") */
  key_header?: string;
  models: CatalogModel[];
}

export const CATALOG: CatalogProvider[] = ${json};
`;

  writeFileSync(OUTPUT, file);
  const kb = (Buffer.byteLength(file) / 1024).toFixed(1);
  console.log(`\n→ ${OUTPUT}`);
  console.log(`  ${providers.length} providers, ${totalModels} models, ${kb} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
