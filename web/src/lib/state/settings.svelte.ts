// ─────────────────────────────────────────────────────────────────────────────
// User settings. Server-persisted (K/V), debounced. The pattern: read once at
// boot into $state, write to settings.foo directly, call persist('foo').
//
// Theme tokens used to live here (colors/blurStrength/etc). Now extracted to
// theme.svelte.ts — settings keeps only the FK (themeId). The legacy fields
// stay in the interface as @deprecated for one release so the migration code
// can read them; the next pass deletes them.
// ─────────────────────────────────────────────────────────────────────────────

import * as api from '../api';
import { debounce } from '../utils/debounce';

interface Settings {
  // ── Theme ────────────────────────────────────────────────────────────────
  background: string;
  /** Active theme ID. The cascade lives in theme.svelte.ts. */
  themeId: string | null;

  /** @deprecated Migrated to theme.active.colors. Read by maybeMigrateLegacy() once. */
  colors: unknown;
  /** @deprecated Migrated to theme.active.layout.blur_strength. */
  blurStrength: unknown;
  /** @deprecated Migrated to theme.active.layout.shadow_width. */
  shadowWidth: unknown;
  /** @deprecated Migrated to theme.active.layout.font_scale. */
  fontScale: unknown;
  /** @deprecated Migrated to theme.active.layout.font. */
  font: unknown;

  // ── Chat behaviour ───────────────────────────────────────────────────────
  /** Show {{user}}/{{char}} as plain names in rendered messages. */
  showMacrosInMessages: boolean;
  /** Auto-scroll to bottom on new message. */
  autoScroll: boolean;
  /** Confirm before deleting messages. */
  confirmDelete: boolean;
  /** Send on Enter (Shift+Enter for newline) vs Ctrl+Enter. */
  sendOnEnter: boolean;
  /** Render markdown in messages (vs plain text). */
  renderMarkdown: boolean;
  /** Allow <style> blocks in messages (the scoped CSS pipeline). */
  allowMessageStyles: boolean;

  // ── Generation ───────────────────────────────────────────────────────────
  /** Default system prompt template. {{char}}/{{user}} expanded at build time. */
  systemPrompt: string;
  /** Active connection ID. */
  connectionId: string | null;
  /** Active preset ID. */
  presetId: string | null;
  /** Active persona ID. */
  personaId: string | null;
  /** post-process mode. */
  postProcess: 'none' | 'merge' | 'semi' | 'strict' | 'single';

  // ── World info ───────────────────────────────────────────────────────────
  /** Globally active lorebook IDs (in addition to per-character books). */
  globalLorebooks: string[];

  // ── UI persistence ───────────────────────────────────────────────────────
  /** InlineDrawer collapse state. Keys are arbitrary section identifiers. */
  collapsedSections: string[];
  /** Drag-to-resize geometry. number = single-axis; [w,h] = popup 'both'. */
  panelSizes: Record<string, number | [number, number]>;
}

const DEFAULTS: Settings = {
  background: '',
  themeId: null,
  colors: undefined,
  blurStrength: undefined,
  shadowWidth: undefined,
  fontScale: undefined,
  font: undefined,

  showMacrosInMessages: false,
  autoScroll: true,
  confirmDelete: true,
  sendOnEnter: true,
  renderMarkdown: true,
  allowMessageStyles: true,

  systemPrompt: "Write {{char}}'s next reply in a fictional chat between {{char}} and {{user}}.",
  connectionId: null,
  presetId: null,
  personaId: null,
  postProcess: 'merge',

  globalLorebooks: [],

  collapsedSections: [],
  panelSizes: {},
};

export const settings = $state<Settings>({ ...DEFAULTS });

let dirty = $state<Set<keyof Settings>>(new Set());
let loaded = false;

const flushDirty = debounce(() => {
  if (dirty.size === 0) return;
  const patch: Record<string, unknown> = {};
  for (const k of dirty) patch[k] = settings[k];
  dirty = new Set();
  api.settings.patch(patch).catch(console.error);
}, 1000);

/**
 * Mark a key dirty and schedule a save. Components write to `settings.foo`
 * directly (it's $state) and call this when done. We could $effect-track
 * every key but that fires on load too; explicit dirty is simpler.
 */
export function persist(key: keyof Settings): void {
  if (!loaded) return;
  dirty.add(key);
  dirty = new Set(dirty);
  flushDirty();
}

/**
 * Returns whether a section is collapsed and a setter that flips + persists.
 * The InlineDrawer binds `open` to the inverse of this. Per-key persistence
 * means the prompt panel remembers which sections you had open across reload.
 */
export function useCollapsed(key: string): { get: () => boolean; set: (collapsed: boolean) => void } {
  return {
    get: () => settings.collapsedSections.includes(key),
    set: (collapsed: boolean) => {
      const has = settings.collapsedSections.includes(key);
      if (collapsed && !has) {
        settings.collapsedSections = [...settings.collapsedSections, key];
        persist('collapsedSections');
      } else if (!collapsed && has) {
        settings.collapsedSections = settings.collapsedSections.filter((k) => k !== key);
        persist('collapsedSections');
      }
    },
  };
}

/** Type guard: is `k` a key of Settings? */
function isSettingsKey(k: string): k is keyof Settings {
  return k in DEFAULTS;
}

/** Boot-time hydration. Server values overlay defaults. */
export async function loadSettings(): Promise<void> {
  const remote = await api.settings.get();
  // The naive `for k of keys: settings[k] = remote[k] as Settings[typeof k]`
  // doesn't typecheck — with k as a union, the LHS is the *intersection* of
  // value types and the RHS is the *union* (TS “writing to a union-keyed
  // index narrows to common assignable”). The cast satisfies neither.
  //
  // hydrate() pins K to a single concrete key per call site. Inside the
  // function K is one specific key, so Settings[K] = Settings[K] is sound.
  // We do still cast `remote[key]` (it's `unknown` from the wire), but the
  // cast is local and the assignment is checked.
  function hydrate<K extends keyof Settings>(key: K): void {
    const v = remote[key];
    if (v !== undefined) settings[key] = v as Settings[K];
  }
  for (const k of Object.keys(remote)) {
    if (isSettingsKey(k)) hydrate(k);
  }
  loaded = true;
}
