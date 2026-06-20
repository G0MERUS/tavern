// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT_THEME is the fallback when no themeId is set or hydrate fails. It's
// "Dark Lite" — the same blob seeded into the DB. The store deep-clones this
// on construction; never mutate the original.
// ─────────────────────────────────────────────────────────────────────────────

import type { ThemeData, ThemeColors, ThemeLayout, ThemeToggles } from '../api/types';

export const DEFAULT_COLORS: ThemeColors = {
  body: 'rgba(220, 220, 210, 1)',
  emphasis: 'rgba(145, 145, 145, 1)',
  underline: 'rgba(188, 231, 207, 1)',
  quote: 'rgba(225, 138, 36, 1)',          // The orange. Don't touch.
  shadow: 'rgba(0, 0, 0, 1)',
  blurTint: 'rgba(23, 23, 23, 0.9)',
  chatTint: 'rgba(23, 23, 23, 1)',
  border: 'rgba(0, 0, 0, 0.5)',
  userMesBlurTint: 'rgba(0, 0, 0, 0.3)',
  botMesBlurTint: 'rgba(0, 0, 0, 0.3)',
};

export const DEFAULT_LAYOUT: ThemeLayout = {
  font_scale: 1,
  blur_strength: 10,
  shadow_width: 2,
  chat_width: 50,
  corner_radius: 10,
  message_density: 1,
  avatar_style: 'circle',
  chat_display: 'flat',
  font: '',
};

export const DEFAULT_TOGGLES: ThemeToggles = {
  reduced_motion: false,
  no_blur: false,
  no_shadows: false,
  compact_input: false,
  timestamps: true,
  model_icon: false,
  message_ids: false,
  token_count: false,
  gen_timer: false,
  hide_avatars: false,
  expand_actions: false,
  swipe_count_all: false,
};

export const DEFAULT_THEME: ThemeData = {
  colors: DEFAULT_COLORS,
  layout: DEFAULT_LAYOUT,
  toggles: DEFAULT_TOGGLES,
  custom_css: '',
};

/** IDs of the migration-seeded rows. ThemeBar disables Delete on these. */
export const BUNDLED_IDS = new Set([
  'dark-lite',
  'azure',
  'cappuccino',
  'celestial-macaron',
  'dark-v1',
]);

/**
 * Curated font picker entries. Free text is always valid (Combobox doesn't
 * validate font-family — the CSS engine does), but these get a friendly label
 * and a CDN link injected when picked.
 */
export const FONTS = [
  { value: '', label: 'Noto Sans (default)' },
  { value: 'Inter, sans-serif', label: 'Inter' },
  { value: '"Atkinson Hyperlegible", sans-serif', label: 'Atkinson Hyperlegible' },
  { value: 'OpenDyslexic, sans-serif', label: 'OpenDyslexic' },
  { value: 'Georgia, serif', label: 'Georgia (serif)' },
  { value: 'ui-monospace, monospace', label: 'System mono' },
];

/**
 * CDN links for the curated non-system fonts. Bunny Fonts (GDPR-friendly,
 * same API as Google). Injected as <link rel=stylesheet> when picked, removed
 * when the font changes.
 */
export const FONT_CDN: Record<string, string> = {
  'Inter, sans-serif': 'https://fonts.bunny.net/css?family=inter:400,700',
  '"Atkinson Hyperlegible", sans-serif': 'https://fonts.bunny.net/css?family=atkinson-hyperlegible:400,700',
  'OpenDyslexic, sans-serif': 'https://fonts.bunny.net/css?family=opendyslexic:400,700',
};
