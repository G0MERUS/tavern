// ─────────────────────────────────────────────────────────────────────────────
// {{...}} text substitution. The original engine is a chevrotain CST visitor;
// we recursive-descent it. Same surface, ~10× smaller. The complexity is in
// the dispatch table, not the parser.
//
// Inside-out evaluation: `{{upper::{{char}}}}` evaluates `{{char}}` first.
// Achieved by recursive expansion of args before lookup.
// ─────────────────────────────────────────────────────────────────────────────

import dayjs from 'dayjs';
import { mulberry32, stringHash } from '../../utils/hash';

export interface MacroEnv {
  // identities
  user: string;
  char: string;
  // character data
  persona: string;
  description: string;
  personality: string;
  scenario: string;
  // model
  model: string;
  // chat state
  messageCount: number;
  lastMessage: string;
  lastUserMessage: string;
  lastCharMessage: string;
  // variables — mutated by setvar/incvar/etc
  chatVars: Record<string, string>;
  globalVars: Record<string, string>;
  // misc
  generationType: string;
  /** Stable seed for {{random}}/{{pick}}. */
  chatIdHash: number;
}

const MAX_DEPTH = 10;

/**
 * Expand all {{...}} macros in `text` against `env`.
 * Side effects: setvar/addvar/incvar/decvar mutate env.chatVars/globalVars.
 * The caller persists chat metadata after evaluation.
 */
export function evaluateMacros(text: string, env: MacroEnv): string {
  return expand(text, env, 0);
}

function expand(text: string, env: MacroEnv, depth: number): string {
  if (depth >= MAX_DEPTH) return text;
  if (!text.includes('{{')) return text;

  let out = '';
  let i = 0;

  while (i < text.length) {
    const open = text.indexOf('{{', i);
    if (open === -1) {
      out += text.slice(i);
      break;
    }
    out += text.slice(i, open);

    // ── Block macros ──────────────────────────────────────────────────────
    if (text[open + 2] === '#') {
      const block = parseBlock(text, open);
      if (block) {
        out += dispatchBlock(block.name, block.cond, block.body, block.elseBody, env, depth);
        i = block.end;
        continue;
      }
    }

    // ── Inline macros ─────────────────────────────────────────────────────
    const close = findMatchingClose(text, open);
    if (close === -1) {
      // Unclosed — emit literally and bail.
      out += text.slice(open);
      break;
    }
    const inner = text.slice(open + 2, close);
    out += dispatchInline(inner, env, depth);
    i = close + 2;
  }

  return out;
}

/**
 * Find `}}` matching the `{{` at `openPos`, accounting for nested macros.
 * `{{upper::{{char}}}}` → close at index 17, not 12.
 */
function findMatchingClose(text: string, openPos: number): number {
  let depth = 1;
  let i = openPos + 2;
  while (i < text.length) {
    if (text[i] === '{' && text[i + 1] === '{') {
      depth++;
      i += 2;
    } else if (text[i] === '}' && text[i + 1] === '}') {
      depth--;
      if (depth === 0) return i;
      i += 2;
    } else {
      i++;
    }
  }
  return -1;
}

interface ParsedBlock {
  name: string;
  cond: string;
  body: string;
  elseBody: string;
  end: number;
}

/**
 * Parse `{{#name cond}}body{{else}}elseBody{{/name}}`.
 * Depth-counted: same-name nesting works (`{{#if a}}{{#if b}}x{{/if}}{{/if}}`).
 */
function parseBlock(text: string, openPos: number): ParsedBlock | null {
  // The head can contain nested macros: `{{#if {{getvar::hp}}>5}}`. Naive
  // indexOf('}}') would stop inside `getvar`. Depth-count from after `{{#`
  // (which is one open already counted).
  const headEnd = findMatchingClose(text, openPos);
  if (headEnd === -1) return null;

  const head = text.slice(openPos + 3, headEnd); // skip {{#
  const sp = head.indexOf(' ');
  const name = (sp === -1 ? head : head.slice(0, sp)).toLowerCase();
  const cond = sp === -1 ? '' : head.slice(sp + 1);

  // Walk forward depth-counting same-name open/close. {{else}} only counts
  // at depth 1 (it belongs to *this* block, not nested ones).
  const openTag = `{{#${name}`;
  const closeTag = `{{/${name}}}`;
  const elseTag = '{{else}}';
  let depth = 1;
  let i = headEnd + 2;
  let elseIdx = -1;

  while (i < text.length) {
    if (text.startsWith(openTag, i)) {
      // Verify it's actually a tag head (followed by space or }}), not a prefix.
      const after = text[i + openTag.length];
      if (after === ' ' || after === '}') { depth++; i += openTag.length; continue; }
    }
    if (text.startsWith(closeTag, i)) {
      depth--;
      if (depth === 0) break;
      i += closeTag.length;
      continue;
    }
    if (depth === 1 && elseIdx === -1 && text.startsWith(elseTag, i)) {
      elseIdx = i;
    }
    i++;
  }
  if (depth !== 0) return null;

  const closePos = i;
  const innerStart = headEnd + 2;
  const body = elseIdx === -1
    ? text.slice(innerStart, closePos)
    : text.slice(innerStart, elseIdx);
  const elseBody = elseIdx === -1
    ? ''
    : text.slice(elseIdx + elseTag.length, closePos);

  return { name, cond, body, elseBody, end: closePos + closeTag.length };
}

// ── Dispatch ─────────────────────────────────────────────────────────────────

function dispatchInline(inner: string, env: MacroEnv, depth: number): string {
  // Comment shorthand.
  if (inner.startsWith('//')) return '';

  const sep = inner.indexOf('::');
  const name = (sep === -1 ? inner : inner.slice(0, sep)).trim().toLowerCase();
  const rawArgs = sep === -1 ? [] : splitArgs(inner.slice(sep + 2));
  // Inside-out: expand each arg first.
  const args = rawArgs.map((a) => expand(a, env, depth + 1));

  const handler = INLINE[name];
  if (handler) return handler(args, env, depth);

  // Variable shorthand: {{anything}} → {{getvar::anything}}
  return env.chatVars[name] ?? '';
}

function dispatchBlock(
  name: string,
  cond: string,
  body: string,
  elseBody: string,
  env: MacroEnv,
  depth: number,
): string {
  switch (name) {
    case 'if': {
      // Expand macros in the condition first — `{{#if {{getvar::hp}}>5}}…`
      const expandedCond = expand(cond, env, depth + 1);
      const branch = evalCondition(expandedCond) ? body : elseBody;
      return expand(branch, env, depth + 1);
    }
    case 'trim':
      return expand(body, env, depth + 1).trim();
    case 'noop':
      return expand(body, env, depth + 1);
    default:
      return '';
  }
}

/**
 * Tiny condition evaluator. Operators: == != < > <= >= , numeric if both
 * sides parse, else string compare. Bare value: truthy = non-empty and not
 * '0'/'false'.
 */
function evalCondition(cond: string): boolean {
  const m = cond.match(/^(.*?)(==|!=|<=|>=|<|>)(.*)$/);
  if (!m) {
    const v = cond.trim();
    return v !== '' && v !== '0' && v.toLowerCase() !== 'false';
  }
  const [, l = '', op = '', r = ''] = m;
  const ls = l.trim();
  const rs = r.trim();
  const ln = Number(ls);
  const rn = Number(rs);
  const numeric = !Number.isNaN(ln) && !Number.isNaN(rn) && ls !== '' && rs !== '';
  const a: number | string = numeric ? ln : ls;
  const b: number | string = numeric ? rn : rs;
  switch (op) {
    case '==': return a === b;
    case '!=': return a !== b;
    case '<':  return a < b;
    case '>':  return a > b;
    case '<=': return a <= b;
    case '>=': return a >= b;
    default: return false;
  }
}

/**
 * Split on `::` at depth 0. `{{lower::{{char}}}}` is one arg, not two.
 * String.split('::') would chop through the inner macro.
 */
function splitArgs(s: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let start = 0;
  let i = 0;
  while (i < s.length) {
    if (s[i] === '{' && s[i + 1] === '{') { depth++; i += 2; continue; }
    if (s[i] === '}' && s[i + 1] === '}') { depth--; i += 2; continue; }
    if (depth === 0 && s[i] === ':' && s[i + 1] === ':') {
      args.push(s.slice(start, i));
      i += 2;
      start = i;
      continue;
    }
    i++;
  }
  args.push(s.slice(start));
  return args;
}

// ── Handlers ─────────────────────────────────────────────────────────────────

type Handler = (args: string[], env: MacroEnv, depth: number) => string;

const num = (s: string | undefined): number => {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const INLINE: Record<string, Handler> = {
  // ── Env lookups ───────────────────────────────────────────────────────────
  user: (_, e) => e.user,
  char: (_, e) => e.char,
  charifnotgroup: (_, e) => e.char,
  group: () => '',  // groups dead, but macro must exist for compat
  persona: (_, e) => e.persona,
  description: (_, e) => e.description,
  personality: (_, e) => e.personality,
  scenario: (_, e) => e.scenario,
  model: (_, e) => e.model,

  // ── Chat ──────────────────────────────────────────────────────────────────
  lastmessage: (_, e) => e.lastMessage,
  lastusermessage: (_, e) => e.lastUserMessage,
  lastcharmessage: (_, e) => e.lastCharMessage,
  messagecount: (_, e) => String(e.messageCount),
  conversationlength: (_, e) => String(e.messageCount),
  generationtype: (_, e) => e.generationType,

  // ── Utility ───────────────────────────────────────────────────────────────
  newline: ([n]) => '\n'.repeat(Math.max(1, num(n) || 1)),
  space: ([n]) => ' '.repeat(Math.max(1, num(n) || 1)),
  upper: ([s]) => (s ?? '').toUpperCase(),
  lower: ([s]) => (s ?? '').toLowerCase(),
  reverse: ([s]) => [...(s ?? '')].reverse().join(''),
  length: ([s]) => String((s ?? '').length),

  // ── Arithmetic ────────────────────────────────────────────────────────────
  add: (a) => String(a.reduce((s, x) => s + num(x), 0)),
  sub: ([a, b]) => String(num(a) - num(b)),
  mul: (a) => String(a.reduce((p, x) => p * num(x), 1)),
  div: ([a, b]) => String(num(a) / (num(b) || 1)),
  mod: ([a, b]) => String(num(a) % (num(b) || 1)),
  min: (a) => String(Math.min(...a.map(num))),
  max: (a) => String(Math.max(...a.map(num))),
  round: ([a]) => String(Math.round(num(a))),
  floor: ([a]) => String(Math.floor(num(a))),
  ceil: ([a]) => String(Math.ceil(num(a))),

  // ── Random ────────────────────────────────────────────────────────────────
  // Seeded with chatIdHash so the same chat turn always rolls the same way
  // across regenerate/swipe. {{pick}} additionally hashes its options so
  // distinct {{pick}} calls roll independently.
  random: (opts, e) => {
    if (opts.length === 0) return '';
    const rand = mulberry32(e.chatIdHash)();
    return opts[Math.floor(rand * opts.length)] ?? '';
  },
  pick: (opts, e) => {
    if (opts.length === 0) return '';
    const seed = e.chatIdHash ^ stringHash(opts.join('\x00'));
    const rand = mulberry32(seed)();
    return opts[Math.floor(rand * opts.length)] ?? '';
  },
  roll: ([dice], e) => {
    const m = (dice ?? '').match(/^(\d+)d(\d+)([+-]\d+)?$/i);
    if (!m) return '0';
    const [, n = '1', sides = '6', mod = '0'] = m;
    const seed = e.chatIdHash ^ stringHash(dice ?? '');
    const rand = mulberry32(seed);
    let total = Number(mod);
    for (let i = 0; i < Number(n); i++) {
      total += Math.floor(rand() * Number(sides)) + 1;
    }
    return String(total);
  },

  // ── Time ──────────────────────────────────────────────────────────────────
  time: () => dayjs().format('HH:mm'),
  date: () => dayjs().format('YYYY-MM-DD'),
  isotime: () => dayjs().format('HH:mm:ss'),
  isodate: () => dayjs().format('YYYY-MM-DD'),
  weekday: () => dayjs().format('dddd'),
  datetimeformat: ([fmt]) => dayjs().format(fmt ?? 'YYYY-MM-DD HH:mm'),

  // ── Variables (side-effecting) ────────────────────────────────────────────
  getvar: ([k], e) => e.chatVars[k ?? ''] ?? '',
  setvar: ([k, v], e) => { if (k) e.chatVars[k] = v ?? ''; return ''; },
  addvar: ([k, d], e) => {
    if (!k) return '';
    e.chatVars[k] = String(num(e.chatVars[k]) + num(d));
    return '';
  },
  incvar: ([k], e) => {
    if (!k) return '';
    const next = String(num(e.chatVars[k]) + 1);
    e.chatVars[k] = next;
    return next;
  },
  decvar: ([k], e) => {
    if (!k) return '';
    const next = String(num(e.chatVars[k]) - 1);
    e.chatVars[k] = next;
    return next;
  },
  getglobalvar: ([k], e) => e.globalVars[k ?? ''] ?? '',
  setglobalvar: ([k, v], e) => { if (k) e.globalVars[k] = v ?? ''; return ''; },
};
