// ─────────────────────────────────────────────────────────────────────────────
// Lorebook scan. Keyword-triggered context injection with recursion, mutual
// exclusion (groups), probability gates, and budget enforcement.
//
// The original is ~4700 LOC; ~3200 of that is jQuery editor wiring. The
// algorithm itself is the ~10 stages below. We keep the algorithm, lose the
// wiring.
//
// Pure: same inputs → same outputs. Probability and group selection are
// seeded with chatIdHash so regenerate/swipe are stable within a chat turn.
// ─────────────────────────────────────────────────────────────────────────────

import { mulberry32, stringHash } from '../utils/hash';
import { estimateTokens } from './tokenize';

// ── Types ────────────────────────────────────────────────────────────────────

/** Backend's LorebookEntry projected into scan shape. */
export interface ScanEntry {
  id: string;
  keys: string[];
  secondary_keys: string[];
  content: string;
  enabled: boolean;
  /** Always activate, ignore keys. */
  constant: boolean;
  /** Apply secondary-key logic. If false, secondary_keys ignored. */
  selective: boolean;
  /** 0=AND_ANY 1=NOT_ALL 2=NOT_ANY 3=AND_ALL */
  selectiveLogic: 0 | 1 | 2 | 3;
  case_sensitive: boolean;
  match_whole_words: boolean;
  /** Where the content lands in the prompt. */
  position: 'before_char' | 'after_char' | 'at_depth';
  /** Only for at_depth. Counts from end of chat history. */
  depth: number | null;
  /** Sort order within position bucket. Lower = earlier. */
  insertion_order: number;
  /** 0–100. */
  probability: number;
  /** This entry never gets cut by budget. */
  ignoreBudget: boolean;
  /** This entry's content is excluded from the recursion scan text. */
  excludeRecursion: boolean;
  /** This entry can only activate on the initial scan, never via recursion. */
  preventRecursion: boolean;
  /** Skip until recursion step N (0 = check from initial). */
  delayUntilRecursion: number;
  /** Mutual-exclusion group. Entries with same non-empty group: one survives. */
  group: string;
  /** This entry wins its group regardless of weight. */
  groupOverride: boolean;
  /** Lottery weight within group. */
  groupWeight: number;
}

export interface ScanOptions {
  /** Concatenated recent chat messages (already cut to scan_depth). */
  scanText: string;
  recursive: boolean;
  /** 0 = unlimited (capped at 10 internally). */
  maxRecursionSteps: number;
  /** Token budget across all activated entries. */
  budget: number;
  /** Global override (forces case-sensitive even if entry says no). */
  caseSensitive: boolean;
  /** Global override (forces whole-word). */
  matchWholeWords: boolean;
  /** Stable seed for probability and group rolls. */
  chatIdHash: number;
}

export interface DepthInjection {
  depth: number;
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ScanResult {
  /** Content for entries with position=before_char, sorted by insertion_order. */
  before: string[];
  /** Content for entries with position=after_char. */
  after: string[];
  /** Entries with position=at_depth. Caller splices into chat history. */
  atDepth: DepthInjection[];
  /** Full activated set (post-budget) for itemized prompt UI. */
  activated: ScanEntry[];
  /** True if budget cut anything. */
  budgetExceeded: boolean;
}

// ── Constants ────────────────────────────────────────────────────────────────

const SAFETY_MAX_RECURSION = 10;
const enum Logic { AND_ANY = 0, NOT_ALL = 1, NOT_ANY = 2, AND_ALL = 3 }

// ── Main ─────────────────────────────────────────────────────────────────────

export function scanLorebook(entries: ScanEntry[], opts: ScanOptions): ScanResult {
  const candidates = entries.filter((e) => e.enabled);
  const activated = new Map<string, ScanEntry>();

  // ── Stage 1: initial activation ────────────────────────────────────────────
  // Constants always fire. Then keyword scan.
  for (const e of candidates) {
    if (e.constant && passesProbability(e, opts.chatIdHash)) {
      activated.set(e.id, e);
    }
  }
  scanPass(candidates, opts.scanText, activated, opts, /* step */ 0);

  // ── Stage 2: recursion ─────────────────────────────────────────────────────
  // Activated content can trigger more entries. Repeat until fixed point or
  // step limit. The scan text for step N is the concat of content activated
  // in step N-1 (excluding excludeRecursion entries).
  if (opts.recursive) {
    const cap = opts.maxRecursionSteps > 0
      ? Math.min(opts.maxRecursionSteps, SAFETY_MAX_RECURSION)
      : SAFETY_MAX_RECURSION;

    let lastActivated = [...activated.values()];

    for (let step = 1; step <= cap; step++) {
      const recursionText = lastActivated
        .filter((e) => !e.excludeRecursion)
        .map((e) => e.content)
        .join('\n');
      if (!recursionText) break;

      const before = activated.size;
      const newlyActivated: ScanEntry[] = [];

      // Track newly-activated for the NEXT step's text. Can't use
      // size delta alone — we need the actual entries.
      const prevIds = new Set(activated.keys());
      scanPass(candidates, recursionText, activated, opts, step);
      for (const [id, e] of activated) {
        if (!prevIds.has(id)) newlyActivated.push(e);
      }

      if (activated.size === before) break;  // fixed point
      lastActivated = newlyActivated;
    }
  }

  // ── Stage 3: group resolution ──────────────────────────────────────────────
  // Mutual exclusion: one entry per non-empty group survives. Override beats
  // weight; otherwise weighted lottery (seeded).
  const survivors = resolveGroups([...activated.values()], opts.chatIdHash);

  // ── Stage 4: budget enforcement ────────────────────────────────────────────
  // Sort by insertion_order; greedily admit until budget. ignoreBudget entries
  // skip the gate (they still count toward total but never get cut).
  const sorted = survivors.toSorted((a, b) => a.insertion_order - b.insertion_order);
  const final: ScanEntry[] = [];
  let used = 0;
  let exceeded = false;

  for (const e of sorted) {
    const cost = estimateTokens(e.content);
    if (e.ignoreBudget) {
      final.push(e);
      used += cost;
      continue;
    }
    if (used + cost > opts.budget) {
      exceeded = true;
      continue;
    }
    final.push(e);
    used += cost;
  }

  // ── Stage 5: position bucketing ────────────────────────────────────────────
  // Already sorted by insertion_order from stage 4.
  const before: string[] = [];
  const after: string[] = [];
  const atDepth: DepthInjection[] = [];

  for (const e of final) {
    switch (e.position) {
      case 'before_char': before.push(e.content); break;
      case 'after_char': after.push(e.content); break;
      case 'at_depth':
        atDepth.push({ depth: e.depth ?? 0, role: 'system', content: e.content });
        break;
    }
  }

  return { before, after, atDepth, activated: final, budgetExceeded: exceeded };
}

// ── Stage 1/2: activation pass ───────────────────────────────────────────────
// Mutates `activated` in place. `step` gates delayUntilRecursion and
// preventRecursion (step > 0 = recursion).

function scanPass(
  candidates: ScanEntry[],
  text: string,
  activated: Map<string, ScanEntry>,
  opts: ScanOptions,
  step: number,
): void {
  for (const e of candidates) {
    if (activated.has(e.id)) continue;
    if (e.constant) continue;  // already handled
    if (step > 0 && e.preventRecursion) continue;
    if (step < e.delayUntilRecursion) continue;

    if (!matchPrimary(e, text, opts)) continue;
    if (!matchSecondary(e, text, opts)) continue;
    if (!passesProbability(e, opts.chatIdHash)) continue;

    activated.set(e.id, e);
  }
}

// ── Key matching ─────────────────────────────────────────────────────────────

function matchPrimary(e: ScanEntry, text: string, opts: ScanOptions): boolean {
  if (e.keys.length === 0) return false;
  return e.keys.some((k) => matchKey(k, text, e, opts));
}

function matchSecondary(e: ScanEntry, text: string, opts: ScanOptions): boolean {
  if (!e.selective || e.secondary_keys.length === 0) return true;

  const matches = e.secondary_keys.map((k) => matchKey(k, text, e, opts));
  const any = matches.some(Boolean);
  const all = matches.every(Boolean);

  switch (e.selectiveLogic) {
    case Logic.AND_ANY: return any;
    case Logic.NOT_ALL: return !all;
    case Logic.NOT_ANY: return !any;
    case Logic.AND_ALL: return all;
    default: return true;
  }
}

/**
 * Test one key against the scan text.
 * Keys wrapped in /…/flags are regex; otherwise plain. Case sensitivity and
 * whole-word are per-entry, OR'd with global option (global is "force on").
 */
function matchKey(key: string, text: string, e: ScanEntry, opts: ScanOptions): boolean {
  if (!key) return false;

  // Regex key: /pattern/flags
  const reMatch = key.match(/^\/(.+)\/([a-z]*)$/);
  if (reMatch) {
    try {
      return new RegExp(reMatch[1]!, reMatch[2]).test(text);
    } catch {
      // Bad regex → fall through to literal match.
    }
  }

  const cs = e.case_sensitive || opts.caseSensitive;
  const ww = e.match_whole_words || opts.matchWholeWords;
  const haystack = cs ? text : text.toLowerCase();
  const needle = cs ? key : key.toLowerCase();

  if (ww) {
    // \b is ASCII-word-boundary. Good enough for English keywords.
    // Escape regex metacharacters in the literal key.
    const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${esc}\\b`).test(haystack);
  }

  return haystack.includes(needle);
}

// ── Probability gate ─────────────────────────────────────────────────────────
// Seeded with (chatIdHash ⊕ entryIdHash) so each entry rolls independently
// but stably within a chat turn.

function passesProbability(e: ScanEntry, chatIdHash: number): boolean {
  if (e.probability >= 100) return true;
  if (e.probability <= 0) return false;
  const seed = chatIdHash ^ stringHash(e.id);
  const roll = mulberry32(seed)() * 100;
  return roll < e.probability;
}

// ── Group resolution ─────────────────────────────────────────────────────────
// Group entries by non-empty `group`. For each group: if any entry has
// groupOverride, that one wins (first by insertion_order if multiple).
// Otherwise, weighted lottery seeded with (chatIdHash ⊕ groupNameHash).

function resolveGroups(entries: ScanEntry[], chatIdHash: number): ScanEntry[] {
  const ungrouped: ScanEntry[] = [];
  const groups = new Map<string, ScanEntry[]>();

  for (const e of entries) {
    if (!e.group) { ungrouped.push(e); continue; }
    const bucket = groups.get(e.group);
    if (bucket) bucket.push(e);
    else groups.set(e.group, [e]);
  }

  for (const [name, members] of groups) {
    if (members.length === 1) {
      ungrouped.push(members[0]!);
      continue;
    }

    // Override wins. Tie-break on insertion_order.
    const overrides = members.filter((m) => m.groupOverride);
    if (overrides.length > 0) {
      overrides.sort((a, b) => a.insertion_order - b.insertion_order);
      ungrouped.push(overrides[0]!);
      continue;
    }

    // Weighted lottery.
    const total = members.reduce((s, m) => s + Math.max(1, m.groupWeight), 0);
    const seed = chatIdHash ^ stringHash(name);
    let roll = mulberry32(seed)() * total;
    for (const m of members) {
      roll -= Math.max(1, m.groupWeight);
      if (roll <= 0) { ungrouped.push(m); break; }
    }
  }

  return ungrouped;
}
