import { describe, expect, it } from 'vitest';
import { isSTTheme, migrateSTTheme, exportSTTheme } from '$lib/compat/theme';
import { sanitizeCss } from '$lib/state/theme.svelte';
import { generateThemePalette } from '$lib/core/theme-generator';

describe('compat/theme', () => {
  // Real ST theme JSON, abbreviated. The detection keys are the load-bearing
  // ones — main_text_color + blur_tint_color.
  const ST_DARK_LITE = {
    name: 'Dark Lite',
    main_text_color: 'rgba(220, 220, 210, 1)',
    italics_text_color: 'rgba(145, 145, 145, 1)',
    underline_text_color: 'rgba(188, 231, 207, 1)',
    quote_text_color: 'rgba(225, 138, 36, 1)',
    blur_tint_color: 'rgba(23, 23, 23, 1)',
    chat_tint_color: 'rgba(23, 23, 23, 1)',
    user_mes_blur_tint_color: 'rgba(30, 30, 30, 0.9)',
    bot_mes_blur_tint_color: 'rgba(30, 30, 30, 0.9)',
    shadow_color: 'rgba(0, 0, 0, 1)',
    border_color: 'rgba(0, 0, 0, 1)',
    font_scale: 1,
    blur_strength: 10,
    shadow_width: 2,
    chat_width: 50,
    fast_ui_mode: true,        // → no_blur: true (inverted name, same sense)
    avatar_style: 1,           // → 'rectangle'
    chat_display: 0,           // → 'flat'
    noShadows: true,
    timestamps_enabled: true,
    timestamp_model_icon: true,
    mesIDDisplay_enabled: false,
    hideChatAvatars_enabled: false,
    message_token_count_enabled: false,
    expand_message_actions: false,
    timer_enabled: false,
    custom_css: '',
    compact_input_area: true,
    reduced_motion: false,
    // Discarded keys — should be silently dropped, not error.
    waifuMode: false,
    enableLabMode: '',
    bogus_folders: true,
  };

  it('isSTTheme: detects on the two color keys', () => {
    expect(isSTTheme(ST_DARK_LITE)).toBe(true);
    expect(isSTTheme({ colors: {}, layout: {} })).toBe(false);
    expect(isSTTheme({ main_text_color: 'x' })).toBe(false); // need both
    expect(isSTTheme(null)).toBe(false);
    expect(isSTTheme('string')).toBe(false);
  });

  it('migrateSTTheme: maps colors verbatim', () => {
    const out = migrateSTTheme(ST_DARK_LITE);
    expect(out.colors.body).toBe('rgba(220, 220, 210, 1)');
    expect(out.colors.quote).toBe('rgba(225, 138, 36, 1)');
    expect(out.colors.chatTint).toBe('rgba(23, 23, 23, 1)');
  });

  it('migrateSTTheme: int enums → string enums', () => {
    const out = migrateSTTheme(ST_DARK_LITE);
    expect(out.layout.avatar_style).toBe('rectangle');  // 1
    expect(out.layout.chat_display).toBe('flat');       // 0
  });

  it('migrateSTTheme: fast_ui_mode → no_blur (NOT inverted — true means blur off)', () => {
    expect(migrateSTTheme({ ...ST_DARK_LITE, fast_ui_mode: true }).toggles.no_blur).toBe(true);
    expect(migrateSTTheme({ ...ST_DARK_LITE, fast_ui_mode: false }).toggles.no_blur).toBe(false);
  });

  it('migrateSTTheme: missing keys → defaults', () => {
    const out = migrateSTTheme({ main_text_color: 'red', blur_tint_color: 'blue' });
    expect(out.layout.corner_radius).toBe(10);
    expect(out.layout.message_density).toBe(1);
    expect(out.layout.font).toBe('');
  });

  it('migrateSTTheme: discarded keys silently dropped', () => {
    const out = migrateSTTheme(ST_DARK_LITE);
    expect('waifuMode' in out).toBe(false);
    expect('bogus_folders' in out).toBe(false);
  });

  it('exportSTTheme → migrateSTTheme: round-trips losslessly', () => {
    const original = migrateSTTheme(ST_DARK_LITE);
    const exported = exportSTTheme(original, 'Dark Lite');
    const reimported = migrateSTTheme(exported);
    expect(reimported).toEqual(original);
  });

  it('exportSTTheme: writes our extras for v2 re-import', () => {
    const data = migrateSTTheme(ST_DARK_LITE);
    data.layout.corner_radius = 15;
    data.layout.font = 'Inter, sans-serif';
    const out = exportSTTheme(data, 'X');
    expect(out.corner_radius).toBe(15);
    expect(out.font).toBe('Inter, sans-serif');
  });

  it('exportSTTheme: string enums → int enums for ST', () => {
    const data = migrateSTTheme(ST_DARK_LITE);
    data.layout.avatar_style = 'square';
    data.layout.chat_display = 'bubbles';
    const out = exportSTTheme(data, 'X');
    expect(out.avatar_style).toBe(2);
    expect(out.chat_display).toBe(1);
  });
});

describe('sanitizeCss', () => {
  it('strips @import', () => {
    expect(sanitizeCss('@import "evil.css"; body { color: red; }'))
      .toBe(' body { color: red; }');
  });

  it('strips @charset', () => {
    expect(sanitizeCss('@charset "utf-8"; .x {}')).toBe(' .x {}');
  });

  it('strips javascript: urls but keeps http(s)', () => {
    const out = sanitizeCss('a { background: url(javascript:alert(1)); } b { background: url(https://x.com/y.png); }');
    expect(out).not.toContain('javascript:');
    expect(out).toContain('https://x.com/y.png');
  });

  it('keeps data: urls', () => {
    const out = sanitizeCss('.x { background: url(data:image/png;base64,abc); }');
    expect(out).toContain('data:image/png');
  });

  it('passes through plain CSS', () => {
    const css = '.mes { padding: 1rem; } button:hover { color: red; }';
    expect(sanitizeCss(css)).toBe(css);
  });

  it('empty → empty', () => {
    expect(sanitizeCss('')).toBe('');
  });
});

describe('generateThemePalette', () => {
  it('returns all 10 ThemeColors keys as rgba strings', () => {
    const out = generateThemePalette({ r: 50, g: 80, b: 120 });
    const keys = ['body', 'emphasis', 'underline', 'quote', 'shadow',
                  'blurTint', 'chatTint', 'border', 'userMesBlurTint', 'botMesBlurTint'];
    for (const k of keys) {
      expect(out[k as keyof typeof out]).toMatch(/^rgba\(\d+, \d+, \d+, [\d.]+\)$/);
    }
  });

  it('dark seed → dark surfaces, light text', () => {
    const out = generateThemePalette({ r: 30, g: 30, b: 40 });
    // Pull the lightness from the body color — should be high.
    const body = out.body!.match(/\d+/g)!.map(Number);
    expect(body[0]! + body[1]! + body[2]!).toBeGreaterThan(400); // sum of RGB > mid-grey
    // blurTint should be dark.
    const tint = out.blurTint!.match(/\d+/g)!.map(Number);
    expect(tint[0]! + tint[1]! + tint[2]!).toBeLessThan(150);
  });

  it('deterministic — same input, same output', () => {
    const a = generateThemePalette({ r: 100, g: 150, b: 200 });
    const b = generateThemePalette({ r: 100, g: 150, b: 200 });
    expect(a).toEqual(b);
  });
});
