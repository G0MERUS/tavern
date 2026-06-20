// ─────────────────────────────────────────────────────────────────────────────
// SSE consumer for /api/generate. The backend passes through the upstream's
// raw text/event-stream — same `data:` lines, same `[DONE]` sentinel. We parse
// it ourselves; EventSource can't POST.
// ─────────────────────────────────────────────────────────────────────────────

import type { ChatMessage, StreamDelta } from './types';
import { ApiError } from './http';

export interface GenerateRequest {
  messages: ChatMessage[];
  /** Override the active connection. */
  connection_id?: string;
  /** Override the active preset. */
  preset_id?: string;
  /** Anything else (model, temperature, max_tokens…) goes straight through. */
  [key: string]: unknown;
}

/**
 * Send a streaming generation request, yield decoded deltas.
 *
 * The full text is the concatenation of every `delta.content`. Caller can also
 * watch for `delta.reasoning` (CoT models) and `delta.finish_reason` (the
 * terminal frame, carries usage).
 */
export async function* generateStream(
  req: GenerateRequest,
  signal?: AbortSignal,
): AsyncGenerator<StreamDelta, void, void> {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...req, stream: true }),
    signal,
  });

  if (!res.ok) {
    let code = 'GENERATION_FAILED';
    let message = res.statusText;
    try {
      const body = await res.json();
      if (body?.error) {
        code = body.error.code ?? code;
        message = body.error.message ?? message;
      }
    } catch { /* not JSON — probably a half-emitted SSE error */ }
    throw new ApiError(res.status, code, message);
  }

  if (!res.body) throw new ApiError(500, 'NO_BODY', 'Response body is null');

  yield* parseSSE(res.body);
}

/**
 * Parse a UTF-8 text/event-stream into deltas.
 *
 * Frame boundary = double newline (`\n\n`). Each frame is one or more `data:`
 * lines (which join with `\n`). `[DONE]` is the OAI sentinel — terminate.
 *
 * Edge case the line-by-line approach gets wrong: a chunk can split mid-line.
 * `data: {"content":"hel` then `lo"}\n\n` is valid. We buffer until we see
 * `\n\n`, not `\n`.
 */
export async function* parseSSE(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<StreamDelta, void, void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Drain complete frames. The last incomplete fragment stays in `buffer`.
      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);

        const delta = parseFrame(frame);
        if (delta === DONE) return;
        if (delta) yield delta;
      }
    }
    // Stream ended without [DONE] — flush remaining buffer if it's a frame.
    if (buffer.trim()) {
      const delta = parseFrame(buffer);
      if (delta && delta !== DONE) yield delta;
    }
  } finally {
    reader.releaseLock();
  }
}

const DONE = Symbol('DONE');

function parseFrame(frame: string): StreamDelta | typeof DONE | null {
  // Multi-line data: per spec, multiple `data:` lines join with newline.
  // Comment (`:`) and other fields (`event:`, `id:`) are ignored.
  const dataLines: string[] = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  if (dataLines.length === 0) return null;

  const data = dataLines.join('\n');
  if (data === '[DONE]') return DONE;

  try {
    const parsed = JSON.parse(data);
    // Backend wraps in {error} on upstream failure mid-stream.
    if (parsed.error) {
      throw new ApiError(502, parsed.error.code ?? 'UPSTREAM', parsed.error.message ?? 'Upstream error');
    }
    // OAI shape: { choices: [{ delta: {...}, finish_reason }], usage }
    // Backend may also normalize to flat { delta: {...}, finish_reason }
    if (parsed.choices?.[0]) {
      const c = parsed.choices[0];
      return {
        content: c.delta?.content ?? undefined,
        reasoning: c.delta?.reasoning_content ?? c.delta?.reasoning ?? undefined,
        finish_reason: c.finish_reason ?? null,
        usage: parsed.usage,
      };
    }
    if (parsed.delta) {
      return {
        content: parsed.delta.content,
        reasoning: parsed.delta.reasoning,
        finish_reason: parsed.finish_reason ?? null,
        usage: parsed.usage,
      };
    }
    return null;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    return null;  // bad JSON in one frame — skip, don't kill the stream
  }
}
