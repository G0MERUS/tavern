// ─────────────────────────────────────────────────────────────────────────────
// Sampler → wire params.
//
// One rule: default = absent. If a slider sits at its default, the key
// doesn't go on the wire. We don't try to know which providers accept
// which keys — that's a static schema for a moving target (Anthropic's OAI
// shim accepts a different set than their native API; o1 rejects
// temperature entirely; next year's models will reject something else).
// The safest request is the smallest one.
//
// This subsumes off-sentinel filtering: top_k=0, seed=-1, rep_pen=1,
// freq_pen=0, n=1 are all the defaults, so they vanish naturally. And it
// handles temperature=1.0 / top_p=1.0 — sending those is identical to not
// sending them on a model that accepts them, but 400s on a model that
// doesn't. Net negative; drop.
//
// Want to force a default-valued param onto the wire? Move the slider one
// step. 0.99 instead of 1.0. You won't need to.
//
// max_tokens is the exception: it's a cap, not a sampler. Some providers
// require it (Anthropic native), and even when optional their default may
// be smaller than what you wanted. Always send it.
//
// The backend spreads preset.params verbatim; with namespaced storage that
// would ship prompts[] to OpenAI. So we don't pass preset_id at all — we
// build the payload here and send it as explicit overrides.
// ─────────────────────────────────────────────────────────────────────────────

import type { SamplerSettings } from '../api/types';
import { DEFAULT_SAMPLERS } from './preset-defaults';

/**
 * Stage a key only if it differs from default. Comparison is exact — slider
 * steps are 0.01 and the defaults (0, 1, -1) are all exactly representable,
 * so float drift isn't a concern.
 */
export function samplersToWire(s: SamplerSettings): Record<string, unknown> {
  const out: Record<string, unknown> = {
    max_tokens: s.openai_max_tokens,
  };

  const stage = <K extends keyof SamplerSettings>(wireKey: string, key: K) => {
    if (s[key] !== DEFAULT_SAMPLERS[key]) out[wireKey] = s[key];
  };

  stage('temperature', 'temperature');
  stage('top_p', 'top_p');
  stage('top_k', 'top_k');
  stage('min_p', 'min_p');
  stage('top_a', 'top_a');
  stage('frequency_penalty', 'frequency_penalty');
  stage('presence_penalty', 'presence_penalty');
  stage('repetition_penalty', 'repetition_penalty');
  stage('seed', 'seed');
  stage('n', 'n');

  // Never staged:
  //   openai_max_context  — frontend budget hint
  //   max_context_unlocked — UI slider affordance
  //   stream              — request envelope, not a sampler
  //   openai_max_tokens   — renamed to max_tokens above

  return out;
}
