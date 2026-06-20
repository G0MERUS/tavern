// ─────────────────────────────────────────────────────────────────────────────
// LorebookEntry → ScanEntry. The backend stores the spec-shaped entry;
// the wild-west fields (group, probability, recursion controls) live in
// `extensions` because they're not part of the V2 lorebook spec — they're
// SillyTavern's own additions, stored under namespaced keys.
//
// This is the only place that knows the namespace. Everything downstream
// gets the flat ScanEntry shape.
// ─────────────────────────────────────────────────────────────────────────────

import type { LorebookEntry } from '../api/types';
import type { ScanEntry } from './worldinfo-scan';

const num = (v: unknown, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const bool = (v: unknown, fallback: boolean): boolean => {
  if (typeof v === 'boolean') return v;
  if (v === 1 || v === '1' || v === 'true') return true;
  if (v === 0 || v === '0' || v === 'false') return false;
  return fallback;
};

const str = (v: unknown, fallback: string): string =>
  typeof v === 'string' ? v : fallback;

export function adaptEntry(e: LorebookEntry): ScanEntry {
  const ext = e.extensions ?? {};

  return {
    id: e.id,
    keys: e.keys,
    secondary_keys: e.secondary_keys,
    content: e.content,
    enabled: e.enabled,
    constant: e.constant,
    selective: e.selective,
    case_sensitive: e.case_sensitive,
    position: e.position,
    depth: e.depth,
    insertion_order: e.insertion_order,

    // ── Extensions ──────────────────────────────────────────────────────────
    // Original keys: selectiveLogic, match_whole_words, useProbability,
    // probability, group, groupOverride, groupWeight, excludeRecursion,
    // preventRecursion, delayUntilRecursion, ignoreBudget. All optional;
    // missing = sane default.
    selectiveLogic: num(ext['selectiveLogic'], 0) as 0 | 1 | 2 | 3,
    match_whole_words: bool(ext['match_whole_words'], false),
    probability: bool(ext['useProbability'], true) ? num(ext['probability'], 100) : 100,
    ignoreBudget: bool(ext['ignoreBudget'], false),
    excludeRecursion: bool(ext['excludeRecursion'], false),
    preventRecursion: bool(ext['preventRecursion'], false),
    delayUntilRecursion: num(ext['delayUntilRecursion'], 0),
    group: str(ext['group'], ''),
    groupOverride: bool(ext['groupOverride'], false),
    groupWeight: num(ext['groupWeight'], 100),
  };
}
