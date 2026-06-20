import { defineConfig } from 'unocss';
import presetWind4 from '@unocss/preset-wind4';
import presetIcons from '@unocss/preset-icons';
import presetTypography from '@unocss/preset-typography';
import transformerVariantGroup from '@unocss/transformer-variant-group';
import extractorSvelte from '@unocss/extractor-svelte';

// ─────────────────────────────────────────────────────────────────────────────
// Theme colors are bound to CSS custom properties, not literal values. The
// theme system writes to :root at runtime; utilities consume the vars at
// compile time. `bg-blur-tint` → `background-color: var(--SmartThemeBlurTintColor)`.
// Theme switching = a dozen :root writes. Zero rebuild, zero re-render.
// ─────────────────────────────────────────────────────────────────────────────

export default defineConfig({
  // extractorSvelte handles class:directive and {expressions} — the default
  // extractor would miss `class:menu-btn={x}`.
  extractors: [extractorSvelte()],
  presets: [
    presetWind4(),
    // warn:false — IconButton builds class strings dynamically
    // (`i-fa6-${weight}:${icon}`); the extractor sees the literal template
    // before Svelte interpolates and warns about malformed icon names.
    // The real icons are safelisted below; the warning is spurious.
    presetIcons({ scale: 1, warn: false }),
    presetTypography(),
  ],
  // Variant groups expand `hover:(x y)` → `hover:x hover:y` in class strings.
  // Used heavily in shortcuts above. Works without attributify.
  transformers: [transformerVariantGroup()],

  theme: {
    colors: {
      // Theme-mutable — written by applyTheme()
      body: 'var(--SmartThemeBodyColor)',
      em: 'var(--SmartThemeEmColor)',
      quote: 'var(--SmartThemeQuoteColor)',
      underline: 'var(--SmartThemeUnderlineColor)',
      'blur-tint': 'var(--SmartThemeBlurTintColor)',
      'chat-tint': 'var(--SmartThemeChatTintColor)',
      'user-mes': 'var(--SmartThemeUserMesBlurTintColor)',
      'bot-mes': 'var(--SmartThemeBotMesBlurTintColor)',
      'st-shadow': 'var(--SmartThemeShadowColor)',
      'st-border': 'var(--SmartThemeBorderColor)',
      // Status — static
      active: 'var(--active)',
      warning: 'var(--warning)',
      golden: 'var(--golden)',
      crimson: 'var(--crimson70a)',
      cobalt: 'var(--cobalt30a)',
    },
    breakpoints: {
      phone: '450px',
      mobile: '1000px',
    },
    borderRadius: {
      sm: '2px',
      DEFAULT: '5px',
      md: '10px',
    },
  },

  // Patterns repeated 50+ times in original style.css. Single source of truth,
  // compiled away — zero runtime cost.
  shortcuts: [
    {
      // Frosted-glass treatment. Drawers, popups, send-form. backdrop-filter
      // killed by body.no-blur in app.css. Radius bound to --panelRadius (the
      // corner_radius theme slider).
      'panel-chrome':
        'bg-blur-tint text-body border border-st-border rounded-[var(--panelRadius)]',

      // The omnipresent button. grayscale-50 → 0 on hover is the original's
      // "dim until hovered" feel. Half-radius of panels.
      'menu-btn':
        'text-body bg-blur-tint border border-st-border rounded-[calc(var(--panelRadius)*0.5)] px-1.5 py-0.75 ' +
        'cursor-pointer flex items-center justify-center text-center select-none ' +
        'transition-all duration-[var(--animation-duration-2x)] ' +
        'filter grayscale-50 hover:(brightness-125 grayscale-0) ' +
        'active:scale-95 disabled:(opacity-50 cursor-not-allowed)',

      'menu-btn-icon': 'menu-btn aspect-square min-w-[2em] p-0',

      // All inputs/selects/textareas.
      'text-pole':
        'bg-black/30 text-body border border-st-border rounded-[calc(var(--panelRadius)*0.5)] px-2 py-1 ' +
        'placeholder:(text-em opacity-70) focus:(outline-none border-body/50) ' +
        'disabled:opacity-50',

      // .mes-btn / .mes-edit-btn live in app.css now (drop-shadow filter +
      // the swipe visibility cascade need plain CSS, not utilities).

      // Top-bar drawer icons.
      'drawer-icon':
        'inline-block cursor-pointer text-[var(--topBarIconSize)] px-[3px] py-px ' +
        'opacity-30 transition-all duration-[var(--animation-duration-2x)] ' +
        'hover:opacity-100 data-[open=true]:opacity-100',

      // Smaller icon buttons (panel headers, list rows).
      'right-menu-btn':
        'cursor-pointer text-center opacity-70 transition-opacity hover:opacity-100',

      // Collapsible section header.
      'inline-drawer-toggle':
        'flex justify-between items-center cursor-pointer py-1 select-none',

      // Slider + linked number input layout.
      'range-block': 'flex flex-col gap-1 w-full',

      // Tag pill.
      'tag-chip':
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ' +
        'border border-st-border cursor-pointer hover:brightness-125',
    },
  ],

  // Lock dynamically-constructed icon classes into the bundle. The TopBar map
  // is `{icon: 'plug'}` → `i-fa6-solid:${icon}` at render time, so the
  // extractor never sees the full class string.
  safelist: [
    // top bar (one per drawer)
    'i-fa6-solid:plug', 'i-fa6-solid:sliders', 'i-fa6-solid:book-atlas',
    'i-fa6-solid:palette', 'i-fa6-solid:image', 'i-fa6-solid:cubes',
    'i-fa6-solid:face-smile', 'i-fa6-solid:address-card', 'i-fa6-solid:gear',
    // toast types
    'i-fa6-solid:circle-info', 'i-fa6-solid:circle-check',
    'i-fa6-solid:triangle-exclamation', 'i-fa6-solid:circle-xmark',
    // message actions (built dynamically by role)
    'i-fa6-solid:pencil', 'i-fa6-solid:trash', 'i-fa6-solid:eye',
    'i-fa6-solid:eye-slash', 'i-fa6-solid:rotate', 'i-fa6-solid:copy',
    'i-fa6-solid:chevron-left', 'i-fa6-solid:chevron-right',
    'i-fa6-solid:paper-plane', 'i-fa6-solid:stop', 'i-fa6-solid:xmark',
    'i-fa6-solid:plus', 'i-fa6-solid:star', 'i-fa6-regular:star',
    'i-fa6-solid:circle-check', 'i-fa6-solid:vial', 'i-fa6-solid:download',
    'i-fa6-solid:globe', 'i-fa6-solid:chevron-down', 'i-fa6-solid:ban',
    'i-fa6-solid:user', 'i-fa6-solid:comments',
    // preset panel
    'i-fa6-solid:floppy-disk', 'i-fa6-solid:file-circle-plus',
    'i-fa6-solid:file-import', 'i-fa6-solid:file-export',
    'i-fa6-solid:trash-can', 'i-fa6-solid:circle-chevron-down',
    'i-fa6-solid:clock-rotate-left', 'i-fa6-solid:link',
    'i-fa6-solid:link-slash', 'i-fa6-solid:arrow-rotate-left',
    'i-fa6-solid:square-plus', 'i-fa6-solid:grip-vertical',
    'i-fa6-solid:syringe', 'i-fa6-solid:thumbtack',
    'i-fa6-solid:square-poll-horizontal', 'i-fa6-solid:asterisk',
    'i-fa6-solid:robot', 'i-fa6-solid:toggle-on', 'i-fa6-solid:toggle-off',
    // theme panel
    'i-fa6-solid:wand-magic-sparkles', 'i-fa6-solid:dice',
    'i-fa6-solid:up-right-and-down-left-from-center',
    // message bubble (header strip + edit strip + swipe + ghost)
    'i-fa6-solid:ellipsis', 'i-fa6-solid:ghost', 'i-fa6-solid:paperclip',
    'i-fa6-solid:flag', 'i-fa6-solid:flag-checkered', 'i-fa6-solid:code-branch',
    'i-fa6-solid:check', 'i-fa6-solid:lightbulb',
    'i-fa6-solid:chevron-up', 'i-fa6-solid:chevron-down',
    // options menu (hamburger + impersonate/continue)
    'i-fa6-solid:bars', 'i-fa6-solid:user-secret', 'i-fa6-solid:arrow-right',
  ],
});
