// ─────────────────────────────────────────────────────────────────────────────
// Theme store. Same lifecycle pattern as preset.svelte.ts: list of rows, one
// active, parse on hydrate, debounced flush on mutate. The new wrinkle is the
// **apply cascade** — this store owns the $effect that writes :root and <body>
// because nobody else should know which keys are vars vs classes vs reads.
//
// One root effect, three sinks: CSS vars, body classes, <style id="theme-css">.
// Runs immediately on store mount and on every active.* mutation. Live preview
// is just "this $effect re-runs."
// ─────────────────────────────────────────────────────────────────────────────

import * as api from '../api';
import type { Theme, ThemeData, ThemeColors, ThemeToggles } from '../api/types';
import { settings, persist } from './settings.svelte';
import { toasts } from './toast.svelte';
import { debounce } from '../utils/debounce';
import {
  DEFAULT_THEME,
  DEFAULT_COLORS,
  DEFAULT_LAYOUT,
  DEFAULT_TOGGLES,
  FONT_CDN,
} from '../core/theme-defaults';
import { migrateSTTheme, exportSTTheme, isSTTheme } from '../compat/theme';

let list = $state<Theme[]>([]);
let active = $state<ThemeData>(structuredClone(DEFAULT_THEME));
let dirty = $state(false);

// Capture the id at queue time. If the user switches themes while a flush is
// in flight, we still write to the *correct* row. Then write the PATCH
// response back into `list` — hydrate() reads from list, not the server, so
// without this every reselect parses stale boot-time data.
const flush = debounce((id: string, data: ThemeData) => {
  api.themes.patch(id, { data })
    .then((updated) => { list = list.map((t) => t.id === updated.id ? updated : t); })
    .catch((e) => toasts.error(`Theme save failed: ${e instanceof Error ? e.message : String(e)}`));
  dirty = false;
}, 800);

function markDirty(): void {
  if (!settings.themeId) return;
  dirty = true;
  // Snapshot now — if we read inside the debounced fn, a select() in the
  // window would have already swapped `active` to a different theme's data.
  flush(settings.themeId, $state.snapshot(active));
}

// ── The cascade ──────────────────────────────────────────────────────────────

const COLOR_VAR: Record<keyof ThemeColors, string> = {
  body: '--SmartThemeBodyColor',
  emphasis: '--SmartThemeEmColor',
  underline: '--SmartThemeUnderlineColor',
  quote: '--SmartThemeQuoteColor',
  shadow: '--SmartThemeShadowColor',
  blurTint: '--SmartThemeBlurTintColor',
  chatTint: '--SmartThemeChatTintColor',
  border: '--SmartThemeBorderColor',
  userMesBlurTint: '--SmartThemeUserMesBlurTintColor',
  botMesBlurTint: '--SmartThemeBotMesBlurTintColor',
};

const BODY_CLASS: Partial<Record<keyof ThemeToggles, string>> = {
  reduced_motion: 'reduced-motion',
  no_blur: 'no-blur',
  no_shadows: 'no-shadows',
  compact_input: 'compact-input',
};

$effect.root(() => {
  // ── Vars + classes. The cheap one — fires on every drag tick. ────────────
  $effect(() => {
    const root = document.documentElement.style;
    const body = document.body.classList;

    // Colors → vars
    for (const k of Object.keys(COLOR_VAR) as (keyof ThemeColors)[]) {
      root.setProperty(COLOR_VAR[k], active.colors[k]);
    }

    // Scalars → vars
    const L = active.layout;
    root.setProperty('--fontScale', String(L.font_scale));
    root.setProperty('--blurStrength', String(L.blur_strength));
    root.setProperty('--shadowWidth', String(L.shadow_width));
    // sheldWidth: write as a *desktop* var that the @media rule overrides on
    // mobile. Can't write --sheldWidth directly — inline :root style beats the
    // breakpoint stylesheet rule, which would lock phones to L.chat_width vw.
    root.setProperty('--sheldWidthDesktop', `${L.chat_width}vw`);
    root.setProperty('--panelRadius', `${L.corner_radius}px`);
    root.setProperty('--mesDensity', String(L.message_density));

    // Font: write only when set (else app.css default wins).
    if (L.font) root.setProperty('--mainFontFamily', L.font);
    else root.removeProperty('--mainFontFamily');

    // Selects → exclusive body classes. 'circle' / 'flat' are the defaults
    // (no class).
    body.toggle('avatar-square', L.avatar_style === 'square');
    body.toggle('avatar-rounded', L.avatar_style === 'rounded');
    body.toggle('avatar-rectangle', L.avatar_style === 'rectangle');
    body.toggle('bubblechat', L.chat_display === 'bubbles');
    body.toggle('documentstyle', L.chat_display === 'document');

    // Swipe-counter visibility. The cascade in app.css reads this; flipping
    // one body class beats re-rendering 2000 message components.
    body.toggle('swipeAllMessages', active.toggles.swipe_count_all);

    // Toggles → body classes (only the 4 that map).
    for (const k of Object.keys(BODY_CLASS) as (keyof ThemeToggles)[]) {
      body.toggle(BODY_CLASS[k]!, active.toggles[k]);
    }

    // PWA chrome — match the panel tint.
    document.querySelector('meta[name=theme-color]')
      ?.setAttribute('content', active.colors.blurTint);
  });

  // ── Font CDN link. Separate so it doesn't fire on color drags. ───────────
  $effect(() => {
    const url = FONT_CDN[active.layout.font];
    let el = document.getElementById('theme-font') as HTMLLinkElement | null;
    if (url) {
      if (!el) {
        el = document.createElement('link');
        el.id = 'theme-font';
        el.rel = 'stylesheet';
        document.head.appendChild(el);
      }
      el.href = url;
    } else {
      el?.remove();
    }
  });

  // ── Custom CSS → injected stylesheet. The expensive one (full reparse). ──
  $effect(() => {
    let el = document.getElementById('theme-css') as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = 'theme-css';
      document.head.appendChild(el);
    }
    el.textContent = sanitizeCss(active.custom_css);
  });
});

/**
 * Strip @import, @charset, and url()s with non-http(s)/data: schemes. Regex,
 * not a parser. ST does the same with an "are you sure?" dialog on import for
 * @import; we silently drop the lines and toast a warning if anything was
 * stripped.
 *
 * The footgun (`* { display: none }`) is the feature. Power users use this
 * specifically to restyle the drawers. Escape hatch: open the K/V table.
 */
export function sanitizeCss(css: string): string {
  if (!css) return '';
  return css
    .replace(/@import\b[^;]*;?/gi, '')
    .replace(/@charset\b[^;]*;?/gi, '')
    // url(javascript:...), url(file:...) etc — keep http(s) and data:
    .replace(/url\(\s*(['"]?)(?!\s*(?:https?:|data:|['"]?\s*\)))[^)]*\)/gi, 'url()');
}

// ── Hydrate ──────────────────────────────────────────────────────────────────

function parse(raw: string): ThemeData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return structuredClone(DEFAULT_THEME);
  }
  if (!parsed || typeof parsed !== 'object') return structuredClone(DEFAULT_THEME);

  // ST theme stored as-is (shouldn't happen post-import but be defensive).
  if (isSTTheme(parsed)) return migrateSTTheme(parsed);

  // Defensively fill any missing namespace with defaults — old saves might
  // predate fields.
  const o = parsed as Partial<ThemeData>;
  return {
    colors: { ...DEFAULT_COLORS, ...o.colors },
    layout: { ...DEFAULT_LAYOUT, ...o.layout },
    toggles: { ...DEFAULT_TOGGLES, ...o.toggles },
    custom_css: typeof o.custom_css === 'string' ? o.custom_css : '',
  };
}

function hydrate(): void {
  const t = list.find((x) => x.id === settings.themeId);
  active = t ? parse(t.data) : structuredClone(DEFAULT_THEME);
  dirty = false;
}

// ── One-time migration off settings.colors ───────────────────────────────────
// On load(), if themeId is null and the legacy keys are still in settings,
// roll them into a new "Custom" theme. The user with hand-tuned colors gets
// them back as a saved theme.

async function maybeMigrateLegacy(): Promise<void> {
  if (settings.themeId) return;

  const legacy = settings.colors;
  const hasLegacy = legacy && typeof legacy === 'object' && 'body' in legacy;
  if (!hasLegacy) {
    // No legacy data — prefer the seeded dark-lite, fall back to whatever's first.
    const first = list.find((t) => t.id === 'dark-lite') ?? list[0];
    if (first) {
      settings.themeId = first.id;
      persist('themeId');
    }
    return;
  }

  const data: ThemeData = {
    colors: { ...DEFAULT_COLORS, ...(legacy as Partial<ThemeColors>) },
    layout: {
      ...DEFAULT_LAYOUT,
      blur_strength: typeof settings.blurStrength === 'number' ? settings.blurStrength : DEFAULT_LAYOUT.blur_strength,
      shadow_width: typeof settings.shadowWidth === 'number' ? settings.shadowWidth : DEFAULT_LAYOUT.shadow_width,
      font_scale: typeof settings.fontScale === 'number' ? settings.fontScale : DEFAULT_LAYOUT.font_scale,
      font: typeof settings.font === 'string' ? settings.font : '',
    },
    toggles: { ...DEFAULT_TOGGLES },
    custom_css: '',
  };

  try {
    const created = await api.themes.create({ name: 'Custom', data });
    list = [...list, created];
    settings.themeId = created.id;
    persist('themeId');
    // Drop the legacy keys. Set undefined → server PATCH writes "undefined"
    // which JSON.parse reads as undefined → next load skips it. (The K/V
    // backend doesn't actually drop rows on undefined, but the field is
    // typed @deprecated unknown so it's effectively dead.)
    settings.colors = undefined;
    settings.blurStrength = undefined;
    settings.shadowWidth = undefined;
    settings.fontScale = undefined;
    settings.font = undefined;
    persist('colors');
    persist('blurStrength');
    persist('shadowWidth');
    persist('fontScale');
    persist('font');
  } catch (e) {
    toasts.error(`Theme migration failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ── Public surface ───────────────────────────────────────────────────────────

export const theme = {
  // ── Reactive reads ────────────────────────────────────────────────────────
  get list() { return list; },
  get activeId() { return settings.themeId; },
  get active() { return active; },
  /** Flat getter so Message.svelte doesn't need to know about the namespace. */
  get toggles() { return active.toggles; },
  get dirty() { return dirty; },

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async load(): Promise<void> {
    const { items } = await api.themes.list();
    list = items;
    await maybeMigrateLegacy();
    hydrate();
  },

  /**
   * Switch theme. Forces any pending save through *first* — `cancel()` here
   * would silently drop edits made <800ms ago.
   */
  async select(id: string): Promise<void> {
    if (dirty) await theme.saveNow();
    flush.cancel();
    settings.themeId = id;
    persist('themeId');
    hydrate();
  },

  async create(name: string): Promise<Theme> {
    flush.cancel();
    dirty = false;  // snapshot lands in the new row — nothing to flush to the old one
    const data = $state.snapshot(active);
    const t = await api.themes.create({ name, data });
    list = [...list, t];
    theme.select(t.id);
    return t;
  },

  async rename(name: string): Promise<void> {
    if (!settings.themeId) return;
    const updated = await api.themes.patch(settings.themeId, { name });
    list = list.map((t) => t.id === updated.id ? updated : t);
  },

  async duplicate(): Promise<Theme | null> {
    if (!settings.themeId) return null;
    flush.cancel();
    dirty = false;
    const current = list.find((t) => t.id === settings.themeId);
    const name = `${current?.name ?? 'Theme'} (copy)`;
    const data = $state.snapshot(active);
    const t = await api.themes.create({ name, data });
    list = [...list, t];
    theme.select(t.id);
    return t;
  },

  async delete(): Promise<void> {
    if (!settings.themeId) return;
    flush.cancel();
    dirty = false;
    const id = settings.themeId;
    await api.themes.delete(id);
    list = list.filter((t) => t.id !== id);
    const next = list[0];
    if (next) theme.select(next.id);
    else { settings.themeId = null; persist('themeId'); active = structuredClone(DEFAULT_THEME); }
  },

  /** Force the debounced save through immediately. */
  async saveNow(): Promise<void> {
    flush.cancel();
    if (!settings.themeId) return;
    dirty = false;
    const updated = await api.themes.patch(settings.themeId, { data: $state.snapshot(active) });
    list = list.map((t) => t.id === updated.id ? updated : t);
  },

  /**
   * Creates a fresh theme from imported JSON. Sniffs ST format and migrates;
   * else accepts our own ThemeData shape.
   *
   * Warns if custom_css contains @import (we strip it on apply but the user
   * should know their <link> won't work).
   */
  async importJSON(json: unknown, filename?: string): Promise<Theme> {
    flush.cancel();
    dirty = false;
    let data: ThemeData;
    let embeddedName: string | undefined;
    if (isSTTheme(json)) {
      data = migrateSTTheme(json);
      embeddedName = typeof (json as Record<string, unknown>)['name'] === 'string'
        ? (json as Record<string, unknown>)['name'] as string
        : undefined;
    } else if (json && typeof json === 'object' && 'colors' in json) {
      const o = json as Partial<ThemeData> & { name?: string };
      data = {
        colors: { ...DEFAULT_COLORS, ...o.colors },
        layout: { ...DEFAULT_LAYOUT, ...o.layout },
        toggles: { ...DEFAULT_TOGGLES, ...o.toggles },
        custom_css: typeof o.custom_css === 'string' ? o.custom_css : '',
      };
      embeddedName = o.name;
    } else {
      throw new Error('Unrecognized theme format');
    }

    if (data.custom_css && /@import/i.test(data.custom_css)) {
      toasts.warning('@import in custom CSS will be stripped');
    }

    const name = filename || embeddedName || 'Imported Theme';
    const t = await api.themes.create({ name, data });
    list = [...list, t];
    theme.select(t.id);
    return t;
  },

  /** Stringify in ST format so it imports back into ST. */
  exportJSON(): string {
    const current = list.find((t) => t.id === settings.themeId);
    return JSON.stringify(exportSTTheme($state.snapshot(active), current?.name ?? 'Theme'), null, 2);
  },

  snapshot(): ThemeData {
    return $state.snapshot(active);
  },

  // ── Mutators ──────────────────────────────────────────────────────────────

  /** Merge a partial palette into colors. The auto-theme button calls this. */
  applyPalette(p: Partial<ThemeColors>): void {
    for (const k of Object.keys(p) as (keyof ThemeColors)[]) {
      const v = p[k];
      if (typeof v === 'string') active.colors[k] = v;
    }
    markDirty();
  },

  /** Generic mutator hook for components. Write to active.* directly, then call this. */
  markDirty,
};
