// ─────────────────────────────────────────────────────────────────────────────
// Message rendering. The two pinned behaviours: double-quoted dialogue gets
// wrapped in <q> (the orange), and DOMPurify strips dangerous content.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, test, expect } from 'vitest';
import { renderMessage, scopeCSS } from '$lib/core/markdown';

describe('renderMessage: quotes', () => {
  test('wraps double-quoted dialogue in <q>', () => {
    const out = renderMessage('She said "hello there".');
    expect(out).toContain('<q>hello there</q>');
  });

  test('multiple quotes per line', () => {
    const out = renderMessage('"first" and "second"');
    expect(out).toContain('<q>first</q>');
    expect(out).toContain('<q>second</q>');
  });

  test('does NOT wrap inside code blocks', () => {
    const out = renderMessage('`"not a quote"`');
    expect(out).not.toContain('<q>');
    expect(out).toContain('<code>');
  });

  test('does NOT wrap inside fenced code', () => {
    const out = renderMessage('```\n"not a quote"\n```');
    expect(out).not.toContain('<q>');
  });

  test('quote spanning newline does NOT wrap', () => {
    // The regex deliberately stops at \n. Multi-paragraph quotes don't
    // exist in roleplay.
    const out = renderMessage('"open\nclose"');
    expect(out).not.toContain('<q>');
  });
});

describe('renderMessage: markdown', () => {
  test('italics → em', () => {
    expect(renderMessage('*italic*')).toContain('<em>italic</em>');
  });

  test('bold → strong', () => {
    expect(renderMessage('**bold**')).toContain('<strong>bold</strong>');
  });

  test('inline code', () => {
    expect(renderMessage('`code`')).toContain('<code>code</code>');
  });

  test('paragraphs', () => {
    const out = renderMessage('first\n\nsecond');
    expect(out).toContain('<p>first</p>');
    expect(out).toContain('<p>second</p>');
  });
});

describe('renderMessage: sanitization', () => {
  test('strips <script>', () => {
    const out = renderMessage('hello <script>alert(1)</script>');
    expect(out).not.toContain('<script>');
    expect(out).not.toContain('alert');
  });

  test('strips on* handlers', () => {
    const out = renderMessage('<img src=x onerror="alert(1)">');
    expect(out).not.toContain('onerror');
  });

  test('strips javascript: URLs', () => {
    const out = renderMessage('[link](javascript:alert(1))');
    expect(out).not.toContain('javascript:');
  });

  test('preserves <q>', () => {
    // DOMPurify must be configured to allow <q> or our quote wrapping
    // is for nothing.
    expect(renderMessage('"hello"')).toContain('<q>hello</q>');
  });

  test('preserves data-* attributes', () => {
    const out = renderMessage('<span data-foo="bar">x</span>');
    expect(out).toContain('data-foo="bar"');
  });
});

describe('renderMessage: HTML pass-through', () => {
  // marked already does GFM-style HTML pass-through. The render pipeline
  // must NOT escape inline HTML — LLMs emit <span style>, <details>, etc.
  // and users expect them to render.

  test('inline HTML survives', () => {
    const out = renderMessage('Hello <span class="foo">world</span>!');
    expect(out).toContain('<span class="foo">world</span>');
  });

  test('inline style attributes survive', () => {
    const out = renderMessage('<span style="color: red">x</span>');
    expect(out).toContain('style="color: red"');
  });

  test('<details>/<summary> survives', () => {
    const out = renderMessage('<details><summary>spoiler</summary>hidden</details>');
    expect(out).toContain('<details>');
    expect(out).toContain('<summary>spoiler</summary>');
  });

  test('markdown inside HTML still parses', () => {
    // marked treats block-level HTML as raw, but inline HTML lets markdown through
    const out = renderMessage('<span>*italic*</span>');
    expect(out).toContain('<em>italic</em>');
  });

  test('mixes markdown and HTML in one paragraph', () => {
    const out = renderMessage('She *whispers* <span style="color:red">"hello"</span>');
    expect(out).toContain('<em>whispers</em>');
    expect(out).toContain('<q>hello</q>');
    expect(out).toContain('color:red');
  });
});

describe('renderMessage: scoped <style> blocks', () => {
  // The encodeStyleTags/decodeStyleTags trick. AI emits <style>p{color:red}</style>;
  // we rewrite selectors so they only affect THIS message, not the whole app.

  test('preserves <style> tag', () => {
    const out = renderMessage('<style>p { color: red }</style>Hello');
    expect(out).toContain('<style>');
    expect(out).toContain('color: red');
  });

  test('scopes selectors to .mes_text', () => {
    const out = renderMessage('<style>p { color: red }</style>Hello');
    // Bare `p` would restyle the whole UI. Must be prefixed.
    expect(out).toMatch(/\.mes_text\s+p\s*\{/);
    expect(out).not.toMatch(/(?<!\.mes_text\s)\bp\s*\{/);
  });

  test('scopes multiple selectors', () => {
    const out = renderMessage('<style>h1, h2, .foo { margin: 0 }</style>x');
    expect(out).toContain('.mes_text h1');
    expect(out).toContain('.mes_text h2');
    expect(out).toContain('.mes_text .foo');
  });

  test('strips javascript: from style url()', () => {
    const out = renderMessage('<style>p { background: url(javascript:alert(1)) }</style>x');
    expect(out).not.toContain('javascript:');
  });

  test('strips @import (would load external CSS)', () => {
    const out = renderMessage('<style>@import url("http://evil/x.css"); p { color: red }</style>x');
    expect(out).not.toContain('@import');
    // But the safe rule survives.
    expect(out).toContain('color: red');
  });

  test('handles broken CSS gracefully (no throw)', () => {
    expect(() => renderMessage('<style>}}}garbage{{{</style>x')).not.toThrow();
  });

  test('multiple style blocks each scoped', () => {
    const out = renderMessage(
      '<style>p{color:red}</style>text<style>em{color:blue}</style>'
    );
    expect(out).toMatch(/\.mes_text\s+p/);
    expect(out).toMatch(/\.mes_text\s+em/);
  });
});

describe('scopeCSS (unit)', () => {
  test('prefixes simple selectors', () => {
    expect(scopeCSS('p { color: red }', '.x')).toBe('.x p { color: red }');
  });

  test('prefixes each selector in a list', () => {
    expect(scopeCSS('a, b { x: 1 }', '.s')).toBe('.s a, .s b { x: 1 }');
  });

  test('handles descendant combinators', () => {
    expect(scopeCSS('div span { x: 1 }', '.s')).toBe('.s div span { x: 1 }');
  });

  test('handles pseudo-classes', () => {
    expect(scopeCSS('a:hover { x: 1 }', '.s')).toBe('.s a:hover { x: 1 }');
  });

  test('strips @import', () => {
    const out = scopeCSS('@import "x.css"; p { color: red }', '.s');
    expect(out).not.toContain('@import');
    expect(out).toContain('.s p { color: red }');
  });

  test('strips @-rules with bodies (charset, namespace)', () => {
    expect(scopeCSS('@charset "UTF-8"; p {}', '.s')).not.toContain('@charset');
  });

  test('preserves @keyframes (animation, can\'t leak)', () => {
    const out = scopeCSS('@keyframes spin { 0% { transform: rotate(0) } } p {}', '.s');
    expect(out).toContain('@keyframes spin');
    // The keyframe percentage selectors must NOT be prefixed.
    expect(out).not.toContain('.s 0%');
  });

  test('handles @media (nested rules get scoped)', () => {
    const out = scopeCSS('@media (max-width: 600px) { p { color: red } }', '.s');
    expect(out).toContain('@media');
    expect(out).toContain('.s p');
  });

  test('strips dangerous url() schemes', () => {
    const out = scopeCSS('p { background: url(javascript:x) }', '.s');
    expect(out).not.toContain('javascript:');
  });

  test('preserves safe url() (data, http, https, relative)', () => {
    expect(scopeCSS('p { background: url(data:image/png;base64,xxx) }', '.s'))
      .toContain('data:image/png');
    expect(scopeCSS('p { background: url(/img/x.png) }', '.s'))
      .toContain('/img/x.png');
  });

  test('handles braces in property values (no false positive on rule end)', () => {
    // CSS strings can contain braces. Naive brace-counting parsers break here.
    const out = scopeCSS('p { content: "}" }', '.s');
    expect(out).toBe('.s p { content: "}" }');
  });

  test('truly broken CSS → empty (don\'t throw)', () => {
    expect(() => scopeCSS('}}}{{{', '.s')).not.toThrow();
  });
});

describe('renderMessage: caching', () => {
  test('same input returns same output reference', () => {
    const a = renderMessage('test string for cache');
    const b = renderMessage('test string for cache');
    // Cache hit: literally the same string object.
    expect(a).toBe(b);
  });
});
