// ─────────────────────────────────────────────────────────────────────────────
// ST theme JSON ↔ ThemeData. Bidirectional — exportSTTheme writes our new
// fields (corner_radius, message_density, font) under their own names. ST
// ignores unknown keys, so a v2 theme re-imports into v2 losslessly and
// degrades gracefully into ST.
//
// Discarded ST keys (read on import, never written on export):
// waifuMode, enableZenSliders, enableLabMode, hotswap_enabled, bogus_folders,
// zoomed_avatar_magnification, media_display, toastr_position. They don't
// round-trip. ST won't notice — its getNewTheme() only copies keys that exist
// on both sides.
// ─────────────────────────────────────────────────────────────────────────────

import type { ThemeData, AvatarStyle, ChatDisplay } from '../api/types';
import { DEFAULT_COLORS, DEFAULT_LAYOUT, DEFAULT_TOGGLES } from '../core/theme-defaults';

type Raw = Record<string, unknown>;

const num = (v: unknown, d: number): number => typeof v === 'number' ? v : d;
const bool = (v: unknown, d: boolean): boolean => typeof v === 'boolean' ? v : d;
const str = (v: unknown, d: string): string => typeof v === 'string' ? v : d;

// ST: 0=circle 1=rectangle 2=square 3=rounded
const AVATAR_INT_TO_STR: AvatarStyle[] = ['circle', 'rectangle', 'square', 'rounded'];
const AVATAR_STR_TO_INT: Record<AvatarStyle, number> = { circle: 0, rectangle: 1, square: 2, rounded: 3 };

// ST: 0=flat 1=bubbles 2=document
const DISPLAY_INT_TO_STR: ChatDisplay[] = ['flat', 'bubbles', 'document'];
const DISPLAY_STR_TO_INT: Record<ChatDisplay, number> = { flat: 0, bubbles: 1, document: 2 };

/** Sniff for the two load-bearing ST color keys. */
export function isSTTheme(json: unknown): boolean {
  return json !== null && typeof json === 'object'
    && 'main_text_color' in json && 'blur_tint_color' in json;
}

export function migrateSTTheme(raw: unknown): ThemeData {
  const o = (raw ?? {}) as Raw;

  return {
    colors: {
      body: str(o['main_text_color'], DEFAULT_COLORS.body),
      emphasis: str(o['italics_text_color'], DEFAULT_COLORS.emphasis),
      underline: str(o['underline_text_color'], DEFAULT_COLORS.underline),
      quote: str(o['quote_text_color'], DEFAULT_COLORS.quote),
      shadow: str(o['shadow_color'], DEFAULT_COLORS.shadow),
      blurTint: str(o['blur_tint_color'], DEFAULT_COLORS.blurTint),
      chatTint: str(o['chat_tint_color'], DEFAULT_COLORS.chatTint),
      border: str(o['border_color'], DEFAULT_COLORS.border),
      userMesBlurTint: str(o['user_mes_blur_tint_color'], DEFAULT_COLORS.userMesBlurTint),
      botMesBlurTint: str(o['bot_mes_blur_tint_color'], DEFAULT_COLORS.botMesBlurTint),
    },
    layout: {
      font_scale: num(o['font_scale'], DEFAULT_LAYOUT.font_scale),
      blur_strength: num(o['blur_strength'], DEFAULT_LAYOUT.blur_strength),
      shadow_width: num(o['shadow_width'], DEFAULT_LAYOUT.shadow_width),
      chat_width: num(o['chat_width'], DEFAULT_LAYOUT.chat_width),
      // Our new fields. ST themes won't have them; v2 re-exports will.
      corner_radius: num(o['corner_radius'], DEFAULT_LAYOUT.corner_radius),
      message_density: num(o['message_density'], DEFAULT_LAYOUT.message_density),
      avatar_style: AVATAR_INT_TO_STR[num(o['avatar_style'], 0)] ?? 'circle',
      chat_display: DISPLAY_INT_TO_STR[num(o['chat_display'], 0)] ?? 'flat',
      font: str(o['font'], ''),
    },
    toggles: {
      reduced_motion: bool(o['reduced_motion'], DEFAULT_TOGGLES.reduced_motion),
      // ST's name is backwards: fast_ui_mode TRUE means blur OFF.
      no_blur: bool(o['fast_ui_mode'], DEFAULT_TOGGLES.no_blur),
      no_shadows: bool(o['noShadows'], DEFAULT_TOGGLES.no_shadows),
      compact_input: bool(o['compact_input_area'], DEFAULT_TOGGLES.compact_input),
      timestamps: bool(o['timestamps_enabled'], DEFAULT_TOGGLES.timestamps),
      model_icon: bool(o['timestamp_model_icon'], DEFAULT_TOGGLES.model_icon),
      message_ids: bool(o['mesIDDisplay_enabled'], DEFAULT_TOGGLES.message_ids),
      token_count: bool(o['message_token_count_enabled'], DEFAULT_TOGGLES.token_count),
      gen_timer: bool(o['timer_enabled'], DEFAULT_TOGGLES.gen_timer),
      hide_avatars: bool(o['hideChatAvatars_enabled'], DEFAULT_TOGGLES.hide_avatars),
      expand_actions: bool(o['expand_message_actions'], DEFAULT_TOGGLES.expand_actions),
      swipe_count_all: bool(o['show_swipe_num_all_messages'], DEFAULT_TOGGLES.swipe_count_all),
    },
    custom_css: str(o['custom_css'], ''),
  };
}

/** Serialize in ST format so it imports back into ST. */
export function exportSTTheme(data: ThemeData, name: string): Raw {
  return {
    name,
    main_text_color: data.colors.body,
    italics_text_color: data.colors.emphasis,
    underline_text_color: data.colors.underline,
    quote_text_color: data.colors.quote,
    shadow_color: data.colors.shadow,
    blur_tint_color: data.colors.blurTint,
    chat_tint_color: data.colors.chatTint,
    border_color: data.colors.border,
    user_mes_blur_tint_color: data.colors.userMesBlurTint,
    bot_mes_blur_tint_color: data.colors.botMesBlurTint,
    font_scale: data.layout.font_scale,
    blur_strength: data.layout.blur_strength,
    shadow_width: data.layout.shadow_width,
    chat_width: data.layout.chat_width,
    avatar_style: AVATAR_STR_TO_INT[data.layout.avatar_style],
    chat_display: DISPLAY_STR_TO_INT[data.layout.chat_display],
    custom_css: data.custom_css,
    reduced_motion: data.toggles.reduced_motion,
    fast_ui_mode: data.toggles.no_blur,  // inverted on the way out too
    noShadows: data.toggles.no_shadows,
    compact_input_area: data.toggles.compact_input,
    timestamps_enabled: data.toggles.timestamps,
    timestamp_model_icon: data.toggles.model_icon,
    mesIDDisplay_enabled: data.toggles.message_ids,
    message_token_count_enabled: data.toggles.token_count,
    timer_enabled: data.toggles.gen_timer,
    hideChatAvatars_enabled: data.toggles.hide_avatars,
    expand_message_actions: data.toggles.expand_actions,
    show_swipe_num_all_messages: data.toggles.swipe_count_all,
    // Our extras — ST ignores, v2 reads back.
    corner_radius: data.layout.corner_radius,
    message_density: data.layout.message_density,
    font: data.layout.font,
  };
}
