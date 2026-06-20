#!/usr/bin/env bun
// Convert ST default themes into ThemeData JSON literals for the migration.
// Run once when bumping the bundled set; paste output into 003_themes.sql.
//
//   bun scripts/bake-themes.ts

const SOURCE = 'https://raw.githubusercontent.com/SillyTavern/SillyTavern/release/default/content/themes';
const THEMES = [
  { id: 'dark-lite', file: 'Dark Lite.json' },
  { id: 'azure', file: 'Azure.json' },
  { id: 'cappuccino', file: 'Cappuccino.json' },
  { id: 'celestial-macaron', file: 'Celestial Macaron.json' },
  { id: 'dark-v1', file: 'Dark V 1.0.json' },
];

const AVATAR_STYLE = ['circle', 'rectangle', 'square', 'rounded'] as const;
const CHAT_DISPLAY = ['flat', 'bubbles', 'document'] as const;

function migrate(st: Record<string, unknown>) {
  const num = (v: unknown, d: number) => typeof v === 'number' ? v : d;
  const bool = (v: unknown, d: boolean) => typeof v === 'boolean' ? v : d;
  const str = (v: unknown, d: string) => typeof v === 'string' ? v : d;

  return {
    colors: {
      body: str(st.main_text_color, 'rgba(220, 220, 210, 1)'),
      emphasis: str(st.italics_text_color, 'rgba(145, 145, 145, 1)'),
      underline: str(st.underline_text_color, 'rgba(188, 231, 207, 1)'),
      quote: str(st.quote_text_color, 'rgba(225, 138, 36, 1)'),
      shadow: str(st.shadow_color, 'rgba(0, 0, 0, 1)'),
      blurTint: str(st.blur_tint_color, 'rgba(23, 23, 23, 0.9)'),
      chatTint: str(st.chat_tint_color, 'rgba(23, 23, 23, 1)'),
      border: str(st.border_color, 'rgba(0, 0, 0, 0.5)'),
      userMesBlurTint: str(st.user_mes_blur_tint_color, 'rgba(0, 0, 0, 0.3)'),
      botMesBlurTint: str(st.bot_mes_blur_tint_color, 'rgba(0, 0, 0, 0.3)'),
    },
    layout: {
      font_scale: num(st.font_scale, 1),
      blur_strength: num(st.blur_strength, 10),
      shadow_width: num(st.shadow_width, 2),
      chat_width: num(st.chat_width, 50),
      corner_radius: 10,
      message_density: 1,
      avatar_style: AVATAR_STYLE[num(st.avatar_style, 0)] ?? 'circle',
      chat_display: CHAT_DISPLAY[num(st.chat_display, 0)] ?? 'flat',
      font: '',
    },
    toggles: {
      reduced_motion: bool(st.reduced_motion, false),
      no_blur: bool(st.fast_ui_mode, false),
      no_shadows: bool(st.noShadows, false),
      compact_input: bool(st.compact_input_area, false),
      timestamps: bool(st.timestamps_enabled, true),
      model_icon: bool(st.timestamp_model_icon, false),
      message_ids: bool(st.mesIDDisplay_enabled, false),
      token_count: bool(st.message_token_count_enabled, false),
      gen_timer: bool(st.timer_enabled, false),
      hide_avatars: bool(st.hideChatAvatars_enabled, false),
      expand_actions: bool(st.expand_message_actions, false),
      swipe_count_all: bool(st.show_swipe_num_all_messages, false),
    },
    custom_css: str(st.custom_css, ''),
  };
}

const rows: string[] = [];
for (const { id, file } of THEMES) {
  const res = await fetch(`${SOURCE}/${encodeURIComponent(file)}`);
  if (!res.ok) {
    console.error(`✗ ${file}: ${res.status}`);
    continue;
  }
  const st = await res.json();
  const data = migrate(st);
  // SQL string literal: escape single quotes by doubling.
  const json = JSON.stringify(data).replace(/'/g, "''");
  rows.push(`  ('${id}', '${st.name}', '${json}', 1)`);
  console.error(`✓ ${id}`);
}

console.log('INSERT OR IGNORE INTO themes (id, name, data, is_bundled) VALUES');
console.log(rows.join(',\n') + ';');
