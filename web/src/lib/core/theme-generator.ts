// ─────────────────────────────────────────────────────────────────────────────
// Direct port of ST public/scripts/util/ThemeGenerator.js. The oklch math is
// correct and the WCAG contrast pump is genuinely well done — kept verbatim,
// types tightened, JSDoc dropped.
//
// Three exports:
//   extractDominantColor(url) — sample a background image, return seed RGB
//   generateThemePalette(seed) — build all 10 ThemeColors from one RGB
//   randomPalette() — generateThemePalette over a random hue
//
// ST's output keys (main_text_color etc) are remapped to ours (body etc) at
// the bottom of generateThemePalette. The math doesn't change — only the
// field names on the return object.
// ─────────────────────────────────────────────────────────────────────────────

import type { ThemeColors } from '../api/types';

export interface RGB { r: number; g: number; b: number }
interface LCH { L: number; C: number; h: number }

// ── sRGB ↔ Linear ↔ Oklch ────────────────────────────────────────────────────

function srgbToLinear(c: number): number {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.round(Math.min(255, Math.max(0, v * 255)));
}

function srgbToOklch(r: number, g: number, b: number): LCH {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const ok_b = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

  return {
    L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    C: Math.sqrt(a * a + ok_b * ok_b),
    h: Math.atan2(ok_b, a),
  };
}

function oklchToSrgb(L: number, C: number, h: number): RGB {
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return {
    r: linearToSrgb(+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s),
  };
}

// ── WCAG contrast ────────────────────────────────────────────────────────────

function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function contrastRatio(c1: RGB, c2: RGB): number {
  const l1 = relativeLuminance(c1.r, c1.g, c1.b);
  const l2 = relativeLuminance(c2.r, c2.g, c2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Pump lightness up/down until contrast vs ref hits the floor. 50 iters max. */
function ensureContrast(L: number, C: number, h: number, refRgb: RGB, minContrast: number, preferLight: boolean): LCH {
  const direction = preferLight ? 0.02 : -0.02;
  for (let i = 0; i < 50; i++) {
    const rgb = oklchToSrgb(L, C, h);
    if (contrastRatio(rgb, refRgb) >= minContrast) return { L, C, h };
    L = Math.min(1, Math.max(0, L + direction));
  }
  return { L, C, h };
}

function rgba(rgb: RGB, alpha = 1): string {
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

// ── Public ───────────────────────────────────────────────────────────────────

/**
 * Sample the background at `imageUrl`, return its dominant vivid color.
 *
 * ST takes an HTMLImageElement; we take a URL, construct an Image, await
 * decode(). Same canvas draw, same chroma-weighted average. The cross-origin
 * warning ST has doesn't apply — backgrounds are same-origin under /blobs/.
 */
export async function extractDominantColor(imageUrl: string): Promise<RGB> {
  const img = new Image();
  img.src = imageUrl;
  try {
    await img.decode();
  } catch {
    return { r: 128, g: 128, b: 128 };
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return { r: 128, g: 128, b: 128 };

  // Sample at reduced resolution.
  const maxDim = 150;
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const width = canvas.width = Math.max(1, Math.floor(img.naturalWidth * scale));
  const height = canvas.height = Math.max(1, Math.floor(img.naturalHeight * scale));
  ctx.drawImage(img, 0, 0, width, height);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, width, height).data;
  } catch {
    return { r: 128, g: 128, b: 128 };
  }

  // Chroma²-weighted average in oklch. Circular mean (sin/cos) for hue
  // wraparound. The +0.001 base weight means even pure-grey images converge.
  const step = 4;
  let totalWeight = 0;
  let wL = 0, wC = 0, wSinH = 0, wCosH = 0;
  let samples = 0;

  for (let i = 0; i < data.length; i += 4 * step) {
    const alpha = data[i + 3]!;
    if (alpha < 128) continue;
    const lch = srgbToOklch(data[i]!, data[i + 1]!, data[i + 2]!);
    const w = lch.C * lch.C + 0.001;
    totalWeight += w;
    wL += lch.L * w;
    wC += lch.C * w;
    wSinH += Math.sin(lch.h) * w;
    wCosH += Math.cos(lch.h) * w;
    samples++;
  }

  if (samples === 0) return { r: 128, g: 128, b: 128 };

  wL /= totalWeight;
  wC /= totalWeight;
  const avgH = Math.atan2(wSinH / totalWeight, wCosH / totalWeight);

  // Boost chroma slightly for a more vivid base. Cap so we don't get neon.
  const boostedC = Math.min(wC * 1.3, 0.35);
  return oklchToSrgb(wL, boostedC, avgH);
}

/**
 * Build all 10 ThemeColors from one seed RGB. Triadic/analogous in oklch with
 * accessibility contrast checking against the derived panel background.
 */
export function generateThemePalette(seed: RGB): Partial<ThemeColors> {
  const base = srgbToOklch(seed.r, seed.g, seed.b);

  const bgLuminance = relativeLuminance(seed.r, seed.g, seed.b);
  const isDark = bgLuminance < 0.3;

  // ── Surfaces ──────────────────────────────────────────────────────────────
  const blurTintL = isDark ? Math.max(base.L * 0.5, 0.08) : Math.min(base.L * 0.35, 0.25);
  const blurTintC = base.C * 0.5;
  const blurTintRgb = oklchToSrgb(blurTintL, blurTintC, base.h);

  const chatTintRgb = oklchToSrgb(blurTintL * 0.9, blurTintC * 0.8, base.h);

  // User/bot tints: ±9° hue shift.
  const userTintRgb = oklchToSrgb(blurTintL, base.C * 0.4, base.h + 0.15);
  const botTintRgb = oklchToSrgb(blurTintL, base.C * 0.4, base.h - 0.15);

  // ── Text (contrast-checked against panel bg) ──────────────────────────────
  const panelBg = blurTintRgb;
  const panelIsDark = relativeLuminance(panelBg.r, panelBg.g, panelBg.b) < 0.3;
  const minContrast = 3.5;

  const ANALOGOUS = Math.PI / 3;       // +60°
  const COMPLEMENTARY = Math.PI;       // +180°
  const TRIADIC = (2 * Math.PI) / 3;   // +120°

  // Main: near-white/black with a slight base-hue tint.
  const mainTextC = Math.min(base.C * 0.15, 0.03);
  const mainText = ensureContrast(panelIsDark ? 0.85 : 0.2, mainTextC, base.h, panelBg, minContrast, panelIsDark);
  const mainTextRgb = oklchToSrgb(mainText.L, mainText.C, mainText.h);

  // Italics: analogous +60°, slightly softer.
  const italicsC = Math.min(base.C * 0.5 + 0.02, 0.12);
  const italics = ensureContrast(panelIsDark ? 0.78 : 0.3, italicsC, base.h + ANALOGOUS, panelBg, minContrast, panelIsDark);
  const italicsRgb = oklchToSrgb(italics.L, italics.C, italics.h);

  // Underline: complementary +180°, medium saturation.
  const underlineC = Math.min(base.C * 0.4 + 0.02, 0.10);
  const underline = ensureContrast(panelIsDark ? 0.75 : 0.32, underlineC, base.h + COMPLEMENTARY, panelBg, minContrast, panelIsDark);
  const underlineRgb = oklchToSrgb(underline.L, underline.C, underline.h);

  // Quotes: triadic +120°, more saturated.
  const quoteC = Math.min(base.C * 0.6 + 0.03, 0.14);
  const quote = ensureContrast(panelIsDark ? 0.65 : 0.38, quoteC, base.h + TRIADIC, panelBg, minContrast, panelIsDark);
  const quoteRgb = oklchToSrgb(quote.L, quote.C, quote.h);

  // ── Shadow & border ───────────────────────────────────────────────────────
  const shadowRgb = isDark ? { r: 0, g: 0, b: 0 } : { r: 40, g: 40, b: 40 };
  const borderL = isDark ? Math.max(base.L * 0.3, 0.05) : Math.min(base.L * 1.2, 0.6);
  const borderRgb = oklchToSrgb(borderL, base.C * 0.3, base.h);

  return {
    body: rgba(mainTextRgb),
    emphasis: rgba(italicsRgb),
    underline: rgba(underlineRgb),
    quote: rgba(quoteRgb),
    shadow: rgba(shadowRgb, isDark ? 0.8 : 0.3),
    blurTint: rgba(blurTintRgb, 0.95),
    chatTint: rgba(chatTintRgb, 0.6),
    border: rgba(borderRgb, 0.7),
    userMesBlurTint: rgba(userTintRgb, 0.7),
    botMesBlurTint: rgba(botTintRgb, 0.7),
  };
}

/** generateThemePalette over a random hue at L=0.4, C=0.15. */
export function randomPalette(): Partial<ThemeColors> {
  const seed = oklchToSrgb(0.4, 0.15, Math.random() * 2 * Math.PI);
  return generateThemePalette(seed);
}
