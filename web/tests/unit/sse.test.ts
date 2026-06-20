// ─────────────────────────────────────────────────────────────────────────────
// The SSE parser. The thing it must NOT get wrong: chunks splitting mid-line.
// `data: {"content":"hel` then `lo"}\n\n` is valid wire traffic.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, test, expect } from 'vitest';
import { parseSSE } from '$lib/api/generate';

const stream = (chunks: string[]): ReadableStream<Uint8Array> => {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(ctrl) {
      for (const c of chunks) ctrl.enqueue(enc.encode(c));
      ctrl.close();
    },
  });
};

const collect = async (s: ReadableStream<Uint8Array>) => {
  const out = [];
  for await (const d of parseSSE(s)) out.push(d);
  return out;
};

describe('parseSSE', () => {
  test('parses one frame', async () => {
    const out = await collect(stream([
      'data: {"choices":[{"delta":{"content":"hello"}}]}\n\n',
    ]));
    expect(out).toEqual([{ content: 'hello', reasoning: undefined, finish_reason: null, usage: undefined }]);
  });

  test('parses sequential frames', async () => {
    const out = await collect(stream([
      'data: {"choices":[{"delta":{"content":"a"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"b"}}]}\n\n',
    ]));
    expect(out.map((d) => d.content)).toEqual(['a', 'b']);
  });

  test('handles chunk split mid-line', async () => {
    // The case the line-by-line approach silently corrupts.
    const out = await collect(stream([
      'data: {"choices":[{"delta":{"content":"hel',
      'lo"}}]}\n\n',
    ]));
    expect(out[0]?.content).toBe('hello');
  });

  test('handles chunk split between frames', async () => {
    const out = await collect(stream([
      'data: {"choices":[{"delta":{"content":"a"}}]}\n',
      '\ndata: {"choices":[{"delta":{"content":"b"}}]}\n\n',
    ]));
    expect(out.map((d) => d.content)).toEqual(['a', 'b']);
  });

  test('two frames in one chunk', async () => {
    const out = await collect(stream([
      'data: {"choices":[{"delta":{"content":"a"}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"b"}}]}\n\n',
    ]));
    expect(out.map((d) => d.content)).toEqual(['a', 'b']);
  });

  test('stops at [DONE]', async () => {
    const out = await collect(stream([
      'data: {"choices":[{"delta":{"content":"a"}}]}\n\n',
      'data: [DONE]\n\n',
      'data: {"choices":[{"delta":{"content":"NEVER"}}]}\n\n',
    ]));
    expect(out.map((d) => d.content)).toEqual(['a']);
  });

  test('extracts reasoning_content', async () => {
    const out = await collect(stream([
      'data: {"choices":[{"delta":{"reasoning_content":"thinking"}}]}\n\n',
    ]));
    expect(out[0]?.reasoning).toBe('thinking');
  });

  test('extracts finish_reason and usage', async () => {
    const out = await collect(stream([
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"completion_tokens":42}}\n\n',
    ]));
    expect(out[0]?.finish_reason).toBe('stop');
    expect(out[0]?.usage?.completion_tokens).toBe(42);
  });

  test('skips bad JSON without killing the stream', async () => {
    const out = await collect(stream([
      'data: {garbage\n\n',
      'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
    ]));
    expect(out.map((d) => d.content)).toEqual(['ok']);
  });

  test('skips comment lines', async () => {
    const out = await collect(stream([
      ': keepalive\n\ndata: {"choices":[{"delta":{"content":"a"}}]}\n\n',
    ]));
    expect(out.map((d) => d.content)).toEqual(['a']);
  });

  test('flat backend-normalized shape', async () => {
    const out = await collect(stream([
      'data: {"delta":{"content":"hello"},"finish_reason":null}\n\n',
    ]));
    expect(out[0]?.content).toBe('hello');
  });

  test('throws ApiError on error frame', async () => {
    const s = stream([
      'data: {"error":{"code":"UPSTREAM","message":"rate limited"}}\n\n',
    ]);
    await expect(collect(s)).rejects.toMatchObject({ code: 'UPSTREAM' });
  });
});
