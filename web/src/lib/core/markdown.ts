// ─────────────────────────────────────────────────────────────────────────────
// Message rendering. The pipeline:
//   1. Wrap "dialogue" in <q> (the orange) — outside code spans
//   2. Encode <style> blocks so DOMPurify can't see them
//   3. marked() — GFM markdown, HTML pass-through enabled
//   4. DOMPurify — strip <script>, on*=, javascript:
//   5. Decode <style> blocks AND scope every selector to .mes_text
//
// Step 5 is the trick. AI emits `<style>p{color:red}</style>` and without
// scoping that bleeds into the whole UI. We can't trust DOMPurify to leave
// <style> alone (it strips them) and we can't trust the AI's CSS, so we
// rewrite selectors AND strip @import + dangerous url() schemes ourselves.
// ─────────────────────────────────────────────────────────────────────────────

import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Sync mode — the async tokenizer is for plugins we don't use.
marked.setOptions({ async: false, gfm: true, breaks: true });

const MESSAGE_SCOPE = '.mes_text';

// LRU-ish: Map preserves insertion order; evict oldest on overflow.
// Keyed by raw content. 200 messages × ~5KB each = 1MB max.
const cache = new Map<string, string>();
const CACHE_MAX = 200;

export function renderMessage(raw: string): string {
  const cached = cache.get(raw);
  if (cached !== undefined) return cached;

  // 1. Encode <style> → DOMPurify-invisible placeholder. Do this BEFORE
  //    quote wrapping so `<style>p::before{content:"x"}</style>` survives.
  const styles: string[] = [];
  const styleEncoded = raw.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_, css: string) => {
    const idx = styles.push(css) - 1;
    return `\x00STYLE${idx}\x00`;
  });

  // 2. Quote wrapping. Mask code regions AND HTML tags so `style="..."`
  //    attributes don't become `style=<q>...</q>`.
  const { masked, restore } = maskCodeAndTags(styleEncoded);
  const quoted = masked.replace(/"([^"\n]+)"/g, '<q>$1</q>');
  const encoded = restore(quoted);

  // 3. Markdown.
  const html = marked.parse(encoded) as string;

  // 4. Sanitize.
  const clean = DOMPurify.sanitize(html, {
    ADD_TAGS: ['q'],
    ADD_ATTR: ['style'],  // inline style="" allowed; the dangerous bit is <style> blocks
    ALLOW_DATA_ATTR: true,
  });

  // 5. Decode + scope styles.
  const out = clean.replace(/\x00STYLE(\d+)\x00/g, (_, idx) => {
    const scoped = scopeCSS(styles[Number(idx)] ?? '', MESSAGE_SCOPE);
    return scoped ? `<style>${scoped}</style>` : '';
  });

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(raw, out);
  return out;
}

// ── Quote-protection masking ─────────────────────────────────────────────────
// Sentinel-replace regions where `"..."` must NOT become `<q>`:
//   - fenced code (``` can contain anything, including `)
//   - inline code
//   - HTML tags (`<span class="foo" style="x">` has attribute quotes)
// Order: fenced → inline → tags. Restored after the quote regex runs.

function maskCodeAndTags(text: string): { masked: string; restore: (s: string) => string } {
  const stash: string[] = [];
  const sentinel = (s: string) => `\x00MASK${stash.push(s) - 1}\x00`;

  let masked = text.replace(/```[\s\S]*?```/g, sentinel);
  masked = masked.replace(/`[^`\n]*`/g, sentinel);
  // HTML open/close tags. Lazy: `<` then non-`>` then `>`. Doesn't handle
  // `>` inside attribute values, but neither does the markdown parser, so
  // that's already a lost cause.
  masked = masked.replace(/<\/?[a-zA-Z][^>]*>/g, sentinel);

  return {
    masked,
    restore: (s) => s.replace(/\x00MASK(\d+)\x00/g, (_, i) => stash[Number(i)] ?? ''),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS scoping. Hand-rolled tokenizer because:
//   - We don't need a full CSS AST, just selector-prefix and @-rule filtering.
//   - postcss is 50KB and would need a sandbox anyway (custom syntax plugins
//     can be exploited via @-rules).
//   - The grammar we care about: selector-list { decls } | @rule ;? | @rule {…}
//
// What we do:
//   - Prefix every selector with `${scope} `
//   - Strip @import, @charset, @namespace (load external resources / change parsing)
//   - Recurse into @media/@supports, prefixing nested rules
//   - Pass @keyframes/@font-face through unmodified (can't leak; selectors are
//     keyframe percentages, not DOM selectors)
//   - Strip url() with javascript:/vbscript:/data:text schemes
//
// The string handling matters. `content: "}"` would break naive brace-counting.
// ─────────────────────────────────────────────────────────────────────────────

export function scopeCSS(css: string, scope: string): string {
  try {
    return walkRules(css, scope);
  } catch {
    return '';
  }
}

function walkRules(css: string, scope: string): string {
  const out: string[] = [];
  let i = 0;
  const n = css.length;

  while (i < n) {
    // Skip whitespace.
    while (i < n && /\s/.test(css[i]!)) i++;
    if (i >= n) break;

    // @-rule.
    if (css[i] === '@') {
      const ruleStart = i;
      while (i < n && css[i] !== '{' && css[i] !== ';') i++;
      const prelude = css.slice(ruleStart, i);
      const name = prelude.match(/^@([\w-]+)/)?.[1]?.toLowerCase() ?? '';

      if (css[i] === ';') {
        // Bodyless @-rule (@import, @charset, @namespace). All stripped —
        // they either load externals or change parser state.
        i++;
        continue;
      }

      // @-rule with body.
      const block = readBlock(css, i);
      i = block.end;

      if (name === 'media' || name === 'supports' || name === 'layer' || name === 'container') {
        // Conditional groups: recurse into the body.
        out.push(prelude, '{ ', walkRules(block.inner, scope), ' }');
      } else if (name === 'keyframes' || name.endsWith('-keyframes') || name === 'font-face' || name === 'property') {
        // Pass through. Keyframe selectors are percentages, not DOM selectors;
        // font-face has no selector at all. Still scrub url() inside.
        out.push(prelude, '{', scrubDeclarations(block.inner), '}');
      }
      // Anything else (@page, @counter-style, unknown): drop. Conservative.
      continue;
    }

    // Style rule: selector-list { declarations }.
    const selStart = i;
    while (i < n && css[i] !== '{') {
      // Skip strings in attribute selectors: [foo="}"]
      if (css[i] === '"' || css[i] === "'") { i = skipString(css, i); continue; }
      i++;
    }
    if (i >= n) break;  // unclosed: bail on the rest

    const selector = css.slice(selStart, i).trim();
    const block = readBlock(css, i);
    i = block.end;

    if (!selector) continue;
    const scoped = selector.split(',').map((s) => `${scope} ${s.trim()}`).join(', ');
    out.push(scoped, ' {', scrubDeclarations(block.inner), '}');
  }

  return out.join('');
}

/**
 * Read `{ ... }` starting at the open brace. String-aware: braces inside
 * "..." or '...' don't count. Returns inner text and the index just past `}`.
 */
function readBlock(css: string, openIdx: number): { inner: string; end: number } {
  let depth = 1;
  let i = openIdx + 1;
  const n = css.length;
  while (i < n && depth > 0) {
    const c = css[i]!;
    if (c === '"' || c === "'") { i = skipString(css, i); continue; }
    if (c === '{') depth++;
    else if (c === '}') depth--;
    if (depth > 0) i++;
  }
  return { inner: css.slice(openIdx + 1, i), end: i + 1 };
}

/** Skip past a quoted string starting at `i` (which points at the quote). */
function skipString(css: string, i: number): number {
  const quote = css[i];
  i++;
  while (i < css.length) {
    if (css[i] === '\\') { i += 2; continue; }
    if (css[i] === quote) return i + 1;
    i++;
  }
  return i;
}

/**
 * Strip dangerous url() schemes from a declaration block.
 * `background: url(javascript:alert(1))` → `background: url(about:blank)`.
 * Allowed schemes: http, https, data:image/, blob:, relative paths.
 */
function scrubDeclarations(decls: string): string {
  return decls.replace(/url\(\s*(['"]?)([^)]*?)\1\s*\)/gi, (_, q: string, url: string) => {
    const u = url.trim().toLowerCase();
    const safe =
      u.startsWith('http://') || u.startsWith('https://') || u.startsWith('blob:') ||
      u.startsWith('data:image/') ||
      u.startsWith('/') || u.startsWith('./') || u.startsWith('../') ||
      !u.includes(':');  // bare relative path
    return safe ? `url(${q}${url}${q})` : 'url(about:blank)';
  });
}
