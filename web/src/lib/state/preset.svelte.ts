// ─────────────────────────────────────────────────────────────────────────────
// Preset store. The active preset is parsed once into namespaced $state and
// re-serialized on every (debounced) write. This is the model for the prompt
// manager UI — components read `preset.order`/`preset.prompts` reactively,
// mutate via the methods below.
//
// Save discipline: one debounced flush, 800ms. Mutators write local $state
// synchronously (UI updates instantly), then queue. The flush serializes the
// *whole* PresetParams — partial PATCH of nested JSON at <50KB isn't worth it.
//
// parse() runs the migration ladder on hydrate. sanitize() runs after every
// mutation that touches prompts/order to keep invariants (no orphan refs, all
// reserved markers present).
// ─────────────────────────────────────────────────────────────────────────────

import * as api from '../api';
import type {
  Preset,
  PresetParams,
  PromptDefinition,
  SamplerSettings,
  PresetTemplates,
  PresetBehavior,
} from '../api/types';
import {
  DEFAULT_PROMPTS,
  DEFAULT_ORDER,
  DEFAULT_SAMPLERS,
  DEFAULT_TEMPLATES,
  DEFAULT_BEHAVIOR,
  RESERVED_IDS,
  makeDefaultPreset,
} from '../core/preset-defaults';
import { migrateSTPreset, isSTPreset } from '../compat/preset';
import { estimateTokens } from '../core/tokenize';
import { settings, persist } from './settings.svelte';
import { toasts } from './toast.svelte';
import { debounce } from '../utils/debounce';

let list = $state<Preset[]>([]);
let active = $state<PresetParams | null>(null);

const order = $derived.by(() => {
  const bucket = active?.prompt_order.find((b) => b.character_id === 100000);
  return bucket?.order ?? [];
});

/**
 * Per-prompt token estimate. Markers show 0 — their content is resolved at
 * gen time and we don't have it here.
 *
 * TODO phase 2: wire a dryRun flag through chat.svelte.ts → generateStream
 * that bails after prompt assembly and returns resolved ChatMessage[] per
 * section. Populate marker counts from that. Triggered on panel open + 2s
 * debounced on edit.
 */
const tokenCounts = $derived.by(() => {
  const counts: Record<string, number> = {};
  if (!active) return counts;
  for (const p of active.prompts) {
    counts[p.identifier] = p.marker ? 0 : estimateTokens(p.content);
  }
  return counts;
});

const flush = debounce(() => {
  if (!settings.presetId || !active) return;
  api.presets.patch(settings.presetId, { params: active })
    .catch((e) => toasts.error(`Save failed: ${e instanceof Error ? e.message : String(e)}`));
}, 800);

export const preset = {
  // ── Reactive reads ────────────────────────────────────────────────────────
  get list() { return list; },
  get activeId() { return settings.presetId; },
  get active() { return active; },
  get prompts() { return active?.prompts ?? []; },
  get order() { return order; },
  get tokenCounts() { return tokenCounts; },

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async load(): Promise<void> {
    const { items } = await api.presets.list();
    list = items;
    hydrate();
  },

  select(id: string): void {
    flush.cancel();
    settings.presetId = id;
    persist('presetId');
    hydrate();
  },

  async create(name: string): Promise<Preset> {
    flush.cancel();
    const params = makeDefaultPreset();
    const p = await api.presets.create(name, params);
    list = [...list, p];
    preset.select(p.id);
    return p;
  },

  async rename(name: string): Promise<void> {
    if (!settings.presetId) return;
    const updated = await api.presets.patch(settings.presetId, { name });
    list = list.map((p) => p.id === updated.id ? updated : p);
  },

  async duplicate(): Promise<Preset | null> {
    if (!settings.presetId || !active) return null;
    flush.cancel();
    const current = list.find((p) => p.id === settings.presetId);
    const name = `${current?.name ?? 'Preset'} (copy)`;
    // Deep-clone via roundtrip — active is full of nested arrays/objects.
    const params = JSON.parse(JSON.stringify(active)) as PresetParams;
    const p = await api.presets.create(name, params);
    list = [...list, p];
    preset.select(p.id);
    return p;
  },

  async delete(): Promise<void> {
    if (!settings.presetId || list.length <= 1) return;
    flush.cancel();
    const id = settings.presetId;
    await api.presets.delete(id);
    list = list.filter((p) => p.id !== id);
    // Fall back to first surviving preset.
    const next = list[0];
    if (next) preset.select(next.id);
    else { settings.presetId = null; persist('presetId'); active = null; }
  },

  /** Force the debounced save through immediately. Returns when persisted. */
  async saveNow(): Promise<void> {
    flush.cancel();
    if (!settings.presetId || !active) return;
    await api.presets.patch(settings.presetId, { params: active });
  },

  /**
   * Creates a fresh preset from imported JSON. Identifiers are per-preset
   * UUIDs — a new preset is a new namespace, no collision possible.
   *
   * Name precedence: filename (caller strips extension) > data.name (our own
   * exports embed it; ST presets don't) > "Imported Preset".
   */
  async importJSON(data: unknown, filename?: string): Promise<Preset> {
    flush.cancel();
    let params: PresetParams;
    if (isSTPreset(data)) {
      params = migrateSTPreset(data);
    } else if (data && typeof data === 'object' && 'samplers' in data) {
      params = data as PresetParams;
    } else {
      throw new Error('Unrecognized preset format');
    }
    sanitize(params);
    const embedded = (data && typeof data === 'object' && typeof (data as Record<string, unknown>)['name'] === 'string')
      ? (data as Record<string, unknown>)['name'] as string
      : undefined;
    const name = filename || embedded || 'Imported Preset';
    const p = await api.presets.create(name, params);
    list = [...list, p];
    preset.select(p.id);
    return p;
  },

  exportJSON(): string {
    if (!active) return '{}';
    const current = list.find((p) => p.id === settings.presetId);
    return JSON.stringify({ name: current?.name, ...active }, null, 2);
  },

  // ── Mutators (debounced save) ─────────────────────────────────────────────

  setSampler<K extends keyof SamplerSettings>(k: K, v: SamplerSettings[K]): void {
    if (!active) return;
    active.samplers[k] = v;
    flush();
  },

  setTemplate<K extends keyof PresetTemplates>(k: K, v: string): void {
    if (!active) return;
    active.templates[k] = v;
    flush();
  },

  setBehavior<K extends keyof PresetBehavior>(k: K, v: PresetBehavior[K]): void {
    if (!active) return;
    active.behavior[k] = v;
    flush();
  },

  resetTemplate(k: keyof PresetTemplates): void {
    if (!active) return;
    active.templates[k] = DEFAULT_TEMPLATES[k];
    flush();
  },

  // ── Prompt pool ───────────────────────────────────────────────────────────

  upsertPrompt(p: PromptDefinition): void {
    if (!active) return;
    const idx = active.prompts.findIndex((x) => x.identifier === p.identifier);
    if (idx >= 0) {
      active.prompts[idx] = { ...p };
    } else {
      active.prompts = [...active.prompts, { ...p }];
    }
    flush();
  },

  deletePrompt(identifier: string): void {
    if (!active) return;
    active.prompts = active.prompts.filter((p) => p.identifier !== identifier);
    // Detach from order too.
    detachInternal(identifier);
    flush();
  },

  resetPrompt(identifier: string): void {
    if (!active) return;
    const def = DEFAULT_PROMPTS.find((p) => p.identifier === identifier);
    if (!def) return;
    const idx = active.prompts.findIndex((p) => p.identifier === identifier);
    if (idx >= 0) {
      active.prompts[idx] = { ...def, injection_trigger: [] };
      flush();
    }
  },

  getPrompt(identifier: string): PromptDefinition | undefined {
    return active?.prompts.find((p) => p.identifier === identifier);
  },

  // ── Order ─────────────────────────────────────────────────────────────────

  toggle(identifier: string): void {
    if (!active) return;
    const bucket = getGlobalBucket();
    if (!bucket) return;
    const entry = bucket.order.find((e) => e.identifier === identifier);
    if (entry) {
      entry.enabled = !entry.enabled;
      flush();
    }
  },

  detach(identifier: string): void {
    if (!active) return;
    detachInternal(identifier);
    flush();
  },

  /** Append to order at bottom (less surprising than ST's top-insert). */
  insert(identifier: string): void {
    if (!active) return;
    const bucket = getGlobalBucket();
    if (!bucket) return;
    if (bucket.order.some((e) => e.identifier === identifier)) return;
    bucket.order = [...bucket.order, { identifier, enabled: false }];
    flush();
  },

  /** Full replace from dnd output. The dnd zone hands back identifiers. */
  reorder(identifiers: string[]): void {
    if (!active) return;
    const bucket = getGlobalBucket();
    if (!bucket) return;
    // Preserve enabled state across the reorder.
    const enabledMap = new Map(bucket.order.map((e) => [e.identifier, e.enabled]));
    bucket.order = identifiers.map((id) => ({
      identifier: id,
      enabled: enabledMap.get(id) ?? false,
    }));
    flush();
  },

  /** Replace order with DEFAULT_ORDER. Pool untouched. */
  resetOrder(): void {
    if (!active) return;
    const bucket = getGlobalBucket();
    if (!bucket) return;
    bucket.order = DEFAULT_ORDER.map((o) => ({ ...o }));
    sanitize(active);
    flush();
  },

  // ── Prompt-list import/export (the [📥]/[📤] in PromptManager toolbar) ────
  // Different shape from full-preset export: just prompts + order.

  exportPromptList(): string {
    if (!active) return '{}';
    return JSON.stringify({
      version: 1,
      type: 'full',
      data: {
        // User prompts only.
        prompts: active.prompts.filter((p) => !p.system_prompt && !p.marker),
        prompt_order: order,
      },
    }, null, 2);
  },

  importPromptList(data: unknown): void {
    if (!active) return;
    if (!data || typeof data !== 'object') throw new Error('Invalid format');
    const o = data as { version?: number; data?: { prompts?: unknown[]; prompt_order?: unknown[] } };
    if (!o.data || !Array.isArray(o.data.prompts)) throw new Error('Missing data.prompts');

    // Merge prompts: newer wins on identifier collision.
    const map = new Map(active.prompts.map((p) => [p.identifier, p]));
    for (const raw of o.data.prompts) {
      if (raw && typeof raw === 'object' && typeof (raw as Record<string, unknown>)['identifier'] === 'string') {
        const p = raw as PromptDefinition;
        map.set(p.identifier, normalizeImportedPrompt(p));
      }
    }
    active.prompts = [...map.values()];

    // Replace order.
    if (Array.isArray(o.data.prompt_order)) {
      const bucket = getGlobalBucket();
      if (bucket) {
        bucket.order = o.data.prompt_order
          .filter((e): e is { identifier: string; enabled: boolean } =>
            typeof e === 'object' && e !== null && typeof (e as Record<string, unknown>)['identifier'] === 'string')
          .map((e) => ({ identifier: e.identifier, enabled: e.enabled ?? true }));
      }
    }

    sanitize(active);
    flush();
  },
};

// ── Internals ────────────────────────────────────────────────────────────────

function getGlobalBucket() {
  return active?.prompt_order.find((b) => b.character_id === 100000);
}

function detachInternal(identifier: string): void {
  const bucket = getGlobalBucket();
  if (!bucket) return;
  bucket.order = bucket.order.filter((e) => e.identifier !== identifier);
}

/** Hydrate `active` from the currently selected preset. */
function hydrate(): void {
  const p = list.find((x) => x.id === settings.presetId);
  if (!p) { active = null; return; }
  active = parse(p.params);
}

/**
 * Migration ladder. Runs once when select() hydrates.
 *
 * 1. JSON.parse. On throw → fresh defaults.
 * 2. Old TavernA flat preset (top-level temperature, no `samplers`) → wrap.
 * 3. Raw ST preset (temp_openai, prompts at top) → run compat migrator.
 * 4. Already namespaced → pass through.
 *
 * Always finishes with sanitize() to enforce invariants.
 */
function parse(raw: string): PresetParams {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return makeDefaultPreset();
  }
  if (!parsed || typeof parsed !== 'object') return makeDefaultPreset();
  const o = parsed as Record<string, unknown>;

  let params: PresetParams;

  if ('samplers' in o && 'prompts' in o) {
    // Already namespaced. Defensively fill any missing namespace with defaults
    // (old saves might predate templates/behavior).
    params = {
      samplers: { ...DEFAULT_SAMPLERS, ...(o['samplers'] as Partial<SamplerSettings>) },
      prompts: Array.isArray(o['prompts']) ? o['prompts'] as PromptDefinition[] : [],
      prompt_order: Array.isArray(o['prompt_order']) ? o['prompt_order'] as PresetParams['prompt_order'] : [],
      templates: { ...DEFAULT_TEMPLATES, ...(o['templates'] as Partial<PresetTemplates>) },
      behavior: { ...DEFAULT_BEHAVIOR, ...(o['behavior'] as Partial<PresetBehavior>) },
      extensions: o['extensions'] as Record<string, unknown> | undefined,
    };
  } else if (isSTPreset(o)) {
    // Raw ST preset somehow stored without going through compat. Run it.
    params = migrateSTPreset(o);
  } else if ('temperature' in o || 'top_p' in o || 'max_tokens' in o) {
    // Old TavernA flat preset (sampler-only, top-level keys). Wrap.
    params = {
      samplers: {
        ...DEFAULT_SAMPLERS,
        temperature: typeof o['temperature'] === 'number' ? o['temperature'] : DEFAULT_SAMPLERS.temperature,
        top_p: typeof o['top_p'] === 'number' ? o['top_p'] : DEFAULT_SAMPLERS.top_p,
        top_k: typeof o['top_k'] === 'number' ? o['top_k'] : DEFAULT_SAMPLERS.top_k,
        min_p: typeof o['min_p'] === 'number' ? o['min_p'] : DEFAULT_SAMPLERS.min_p,
        openai_max_tokens: typeof o['max_tokens'] === 'number' ? o['max_tokens'] : DEFAULT_SAMPLERS.openai_max_tokens,
        frequency_penalty: typeof o['frequency_penalty'] === 'number' ? o['frequency_penalty'] : DEFAULT_SAMPLERS.frequency_penalty,
        presence_penalty: typeof o['presence_penalty'] === 'number' ? o['presence_penalty'] : DEFAULT_SAMPLERS.presence_penalty,
        repetition_penalty: typeof o['repetition_penalty'] === 'number' ? o['repetition_penalty'] : DEFAULT_SAMPLERS.repetition_penalty,
        seed: typeof o['seed'] === 'number' ? o['seed'] : DEFAULT_SAMPLERS.seed,
      },
      prompts: [],
      prompt_order: [],
      templates: { ...DEFAULT_TEMPLATES },
      behavior: { ...DEFAULT_BEHAVIOR },
    };
  } else {
    params = makeDefaultPreset();
  }

  sanitize(params);
  return params;
}

/**
 * Invariant maintenance. Port of ST sanitizeServiceSettings() +
 * checkForMissingPrompts(). Runs after parse() and after any mutation that
 * touches prompts/order.
 *
 * - Fill missing fields on each prompt with type-appropriate defaults.
 * - Backfill any of the 12 reserved identifiers missing from pool.
 * - Ensure global bucket exists.
 * - Drop orphan refs (order entries pointing to nonexistent prompts).
 * - Backfill reserved prompts present in pool but missing from order
 *   (append disabled — user can position manually). ST does NOT do this;
 *   we do because re-import otherwise silently loses markers and people
 *   file bugs.
 */
function sanitize(p: PresetParams): void {
  // ── Prompt pool: fill missing fields, backfill reserved ──────────────────
  p.prompts ??= [];
  for (const prompt of p.prompts) {
    prompt.role ??= 'system';
    prompt.content ??= '';
    prompt.system_prompt ??= false;
    prompt.marker ??= false;
    prompt.injection_position ??= 0;
    prompt.injection_depth ??= 4;
    prompt.injection_order ??= 100;
    prompt.injection_trigger ??= [];
    prompt.forbid_overrides ??= false;
  }
  const present = new Set(p.prompts.map((x) => x.identifier));
  for (const def of DEFAULT_PROMPTS) {
    if (!present.has(def.identifier)) {
      p.prompts.push({ ...def, injection_trigger: [] });
      present.add(def.identifier);
    }
  }

  // ── Order: ensure global bucket ──────────────────────────────────────────
  p.prompt_order ??= [];
  let bucket = p.prompt_order.find((b) => b.character_id === 100000);
  if (!bucket) {
    bucket = { character_id: 100000, order: DEFAULT_ORDER.map((o) => ({ ...o })) };
    p.prompt_order = [bucket];
  }

  // ── Order: drop orphans, backfill reserved ───────────────────────────────
  bucket.order = bucket.order.filter((e) => present.has(e.identifier));
  const inOrder = new Set(bucket.order.map((e) => e.identifier));
  for (const id of RESERVED_IDS) {
    if (!inOrder.has(id)) {
      bucket.order.push({ identifier: id, enabled: false });
    }
  }
}

/** Fill missing fields on an imported prompt-list entry. */
function normalizeImportedPrompt(p: PromptDefinition): PromptDefinition {
  return {
    identifier: p.identifier,
    name: p.name ?? '',
    role: p.role ?? 'system',
    content: p.content ?? '',
    system_prompt: p.system_prompt ?? false,
    marker: p.marker ?? false,
    injection_position: p.injection_position ?? 0,
    injection_depth: p.injection_depth ?? 4,
    injection_order: p.injection_order ?? 100,
    injection_trigger: p.injection_trigger ?? [],
    forbid_overrides: p.forbid_overrides ?? false,
  };
}
