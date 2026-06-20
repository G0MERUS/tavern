// ─────────────────────────────────────────────────────────────────────────────
// Provider quirk shims. Each upstream API has a slightly different opinion
// on what a valid message array looks like:
//
//   none   — anything goes (most local backends)
//   merge  — collapse consecutive same-role (Claude, Gemini)
//   semi   — merge + ensure first non-system is user (OpenAI o1-era)
//   strict — merge + enforce strict u/a/u/a alternation (Anthropic legacy)
//   single — collapse everything to one user msg (text-completion shim)
//
// All transforms preserve content; they only reshape role boundaries.
// ─────────────────────────────────────────────────────────────────────────────

import type { ChatMessage } from '../api/types';

export type PostProcessMode = 'none' | 'merge' | 'semi' | 'strict' | 'single';

export function postProcessMessages(
  messages: ChatMessage[],
  mode: PostProcessMode,
): ChatMessage[] {
  switch (mode) {
    case 'none': return messages;
    case 'merge': return merge(messages);
    case 'semi': return ensureUserFirst(merge(messages));
    case 'strict': return enforceAlternation(ensureUserFirst(merge(messages)));
    case 'single': return collapse(messages);
  }
}

const SEP = '\n\n';

/** Collapse consecutive same-role messages into one (joined with \n\n). */
function merge(messages: ChatMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const m of messages) {
    const prev = out.at(-1);
    if (prev && prev.role === m.role) {
      prev.content = `${prev.content}${SEP}${m.content}`;
    } else {
      out.push({ ...m });
    }
  }
  return out;
}

/**
 * Insert empty user message after leading system block if the first
 * non-system message isn't user. Some APIs reject assistant-first.
 */
function ensureUserFirst(messages: ChatMessage[]): ChatMessage[] {
  const idx = messages.findIndex((m) => m.role !== 'system');
  if (idx === -1) return messages;
  if (messages[idx]!.role === 'user') return messages;
  const out = messages.slice();
  out.splice(idx, 0, { role: 'user', content: '' });
  return out;
}

/**
 * Enforce strict u/a/u/a alternation. Mid-stream system messages get hoisted
 * to the leading block (they break alternation no matter where they sit).
 * Then any consecutive same-role pair gets a synthetic empty between.
 *
 * Input is already merged, so consecutive same-role can only arise from
 * the system-hoisting. e.g. user/assistant/system/assistant → after hoist
 * → user/assistant/assistant → needs empty user inserted.
 */
function enforceAlternation(messages: ChatMessage[]): ChatMessage[] {
  // Pull out system messages, leave the rest in order.
  const sys: ChatMessage[] = [];
  const rest: ChatMessage[] = [];
  for (const m of messages) {
    (m.role === 'system' ? sys : rest).push(m);
  }

  // Re-merge after hoist (consecutive same-role can reappear).
  const merged = merge(rest);

  // Splice in empties.
  const out: ChatMessage[] = [];
  for (const m of merged) {
    const prev = out.at(-1);
    if (prev && prev.role === m.role) {
      out.push({ role: prev.role === 'user' ? 'assistant' : 'user', content: '' });
    }
    out.push(m);
  }

  // Re-merge system block (multiple sys → one).
  return [...merge(sys), ...out];
}

/** Collapse everything into one user message. Text-completion shim. */
function collapse(messages: ChatMessage[]): ChatMessage[] {
  const text = messages
    .map((m) => `${m.role === 'system' ? '' : `${m.role}: `}${m.content}`)
    .join(SEP);
  return [{ role: 'user', content: text }];
}
