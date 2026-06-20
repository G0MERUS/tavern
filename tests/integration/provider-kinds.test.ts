import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import type { Server } from 'bun';

import { setupDb, teardownDb } from '../setup.ts';
import { createConnection, activateConnection, createFromCatalog, getConnection } from '../../src/core/connections.ts';
import { generate, generateStream, testConnection } from '../../src/llm/generate.ts';
import { getCatalog, getProvider, findModel } from '../../src/llm/catalog.ts';

// Mock upstreams for all three wire formats. Each captures what we send so
// we can assert the shaper transformed messages/headers/URLs correctly,
// then streams back native-shaped chunks so we can assert the parser
// re-emits OAI shape.

let mockServer: Server;
let captured: { body?: any; headers?: Record<string, string>; url?: string } = {};

function startMock(): number {
  captured = {};
  mockServer = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      captured.url = url.pathname + url.search;
      captured.headers = Object.fromEntries(req.headers);

      // /v1/models — used by all three test paths.
      if (url.pathname.endsWith('/models')) {
        // Anthropic-style /models needs anthropic-version, OAI doesn't.
        // Both return {data: [{id}]}. Gemini returns {models: [{name}]}.
        if (url.search.includes('key=')) {
          // Gemini convention: key in query string.
          return Response.json({ models: [{ name: 'models/gemini-test' }] });
        }
        return Response.json({ data: [{ id: 'test-model' }] });
      }

      // Anthropic native: POST /v1/messages.
      if (url.pathname.endsWith('/messages')) {
        captured.body = await req.json();
        if (captured.body.stream) {
          const enc = new TextEncoder();
          const stream = new ReadableStream({
            start(c) {
              // Real Anthropic event sequence (abridged).
              c.enqueue(enc.encode('event: message_start\ndata: {"type":"message_start","message":{"id":"msg_1","usage":{"input_tokens":42}}}\n\n'));
              c.enqueue(enc.encode('event: content_block_start\ndata: {"type":"content_block_start","index":0}\n\n'));
              c.enqueue(enc.encode('event: ping\ndata: {"type":"ping"}\n\n'));
              c.enqueue(enc.encode('event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}\n\n'));
              c.enqueue(enc.encode('event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" world"}}\n\n'));
              c.enqueue(enc.encode('event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n'));
              c.enqueue(enc.encode('event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"input_tokens":42,"output_tokens":7}}\n\n'));
              c.enqueue(enc.encode('event: message_stop\ndata: {"type":"message_stop"}\n\n'));
              c.close();
            },
          });
          return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
        }
        return Response.json({ id: 'msg_1', content: [{ type: 'text', text: 'reply' }] });
      }

      // Gemini native: POST /v1beta/models/{model}:streamGenerateContent.
      if (url.pathname.includes(':streamGenerateContent')) {
        captured.body = await req.json();
        const enc = new TextEncoder();
        const stream = new ReadableStream({
          start(c) {
            c.enqueue(enc.encode('data: {"candidates":[{"content":{"parts":[{"text":"Hello"}],"role":"model"}}]}\n\n'));
            c.enqueue(enc.encode('data: {"candidates":[{"content":{"parts":[{"text":" world"}],"role":"model"}}]}\n\n'));
            c.enqueue(enc.encode('data: {"candidates":[{"content":{"parts":[{"text":"!"}],"role":"model"},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":12,"candidatesTokenCount":3,"totalTokenCount":15}}\n\n'));
            c.close();
          },
        });
        return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
      }
      if (url.pathname.includes(':generateContent')) {
        captured.body = await req.json();
        return Response.json({ candidates: [{ content: { parts: [{ text: 'reply' }] } }] });
      }

      // OAI: POST /v1/chat/completions (covered more thoroughly in generate.test.ts).
      if (url.pathname.endsWith('/chat/completions')) {
        captured.body = await req.json();
        return Response.json({ choices: [{ message: { content: 'reply' } }] });
      }

      return new Response('not found', { status: 404 });
    },
  });
  return mockServer.port;
}

beforeEach(setupDb);
afterEach(() => {
  mockServer?.stop(true);
  teardownDb();
});

describe("kind: 'anthropic' — request shaper", () => {
  test('routes to /messages, x-api-key, anthropic-version header', async () => {
    const port = startMock();
    const conn = createConnection({
      label: 'Anthropic',
      kind: 'anthropic',
      base_url: `http://127.0.0.1:${port}/v1`,
      api_key: 'sk-ant-test',
      model: 'claude-opus-4-5',
    });
    activateConnection(conn.id);

    await generate({
      messages: [{ role: 'user', content: 'hello' }],
      stream: false,
    });

    expect(captured.url).toBe('/v1/messages');
    expect(captured.headers!['x-api-key']).toBe('sk-ant-test');
    expect(captured.headers!['anthropic-version']).toBe('2023-06-01');
    expect(captured.headers!['authorization']).toBeUndefined(); // NOT Bearer
  });

  test('extracts system messages into top-level system field', async () => {
    const port = startMock();
    const conn = createConnection({
      label: 'Anthropic',
      kind: 'anthropic',
      base_url: `http://127.0.0.1:${port}/v1`,
      model: 'claude-opus-4-5',
    });
    activateConnection(conn.id);

    await generate({
      messages: [
        { role: 'system', content: 'You are a pirate.' },
        { role: 'system', content: 'Speak in rhymes.' },
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'Ahoy there, matey, what say?' },
        { role: 'user', content: 'good day' },
      ],
      stream: false,
    });

    // Multiple system messages → concatenated with \n\n.
    expect(captured.body.system).toBe('You are a pirate.\n\nSpeak in rhymes.');

    // messages[] has NO system role — Anthropic rejects it.
    expect(captured.body.messages).toHaveLength(3);
    expect(captured.body.messages.every((m: any) => m.role !== 'system')).toBe(true);
    expect(captured.body.messages[0]).toEqual({ role: 'user', content: 'hello' });
    expect(captured.body.messages[1]).toEqual({ role: 'assistant', content: 'Ahoy there, matey, what say?' });
  });

  test('max_tokens is required — falls back to 4096 if absent', async () => {
    const port = startMock();
    const conn = createConnection({
      label: 'Anthropic',
      kind: 'anthropic',
      base_url: `http://127.0.0.1:${port}/v1`,
      model: 'claude-opus-4-5',
    });
    activateConnection(conn.id);

    // No preset, no override → fallback
    await generate({
      messages: [{ role: 'user', content: 'x' }],
      stream: false,
    });
    expect(captured.body.max_tokens).toBe(4096);

    // Explicit override wins
    await generate({
      messages: [{ role: 'user', content: 'x' }],
      stream: false,
      max_tokens: 8192,
    });
    expect(captured.body.max_tokens).toBe(8192);
  });

  test('no system messages → no top-level system field', async () => {
    const port = startMock();
    const conn = createConnection({
      label: 'Anthropic',
      kind: 'anthropic',
      base_url: `http://127.0.0.1:${port}/v1`,
      model: 'claude-opus-4-5',
    });
    activateConnection(conn.id);

    await generate({
      messages: [{ role: 'user', content: 'hello' }],
      stream: false,
    });

    expect(captured.body.system).toBeUndefined();
    expect(captured.body.messages).toEqual([{ role: 'user', content: 'hello' }]);
  });
});

describe("kind: 'anthropic' — stream parser", () => {
  test('reshapes content_block_delta into OAI delta chunks, emits [DONE]', async () => {
    const port = startMock();
    const conn = createConnection({
      label: 'Anthropic',
      kind: 'anthropic',
      base_url: `http://127.0.0.1:${port}/v1`,
      model: 'claude-opus-4-5',
    });
    activateConnection(conn.id);

    const chunks: string[] = [];
    for await (const c of generateStream({ messages: [{ role: 'user', content: 'x' }] })) {
      chunks.push(c);
    }
    const joined = chunks.join('');

    // Text deltas come through in OAI shape — same as the OpenAI path.
    // Frontend's existing parser handles this without changes.
    expect(joined).toContain('"delta":{"content":"Hello"}');
    expect(joined).toContain('"delta":{"content":" world"}');

    // Anthropic's message_stop → [DONE]
    expect(joined).toContain('data: [DONE]');

    // Usage from message_delta gets remapped to OAI field names.
    expect(joined).toContain('"completion_tokens":7');

    // Anthropic's native event types do NOT leak through.
    expect(joined).not.toContain('content_block_delta');
    expect(joined).not.toContain('message_start');
    expect(joined).not.toContain('event: ping');

    // Every chunk ends with \n\n.
    expect(chunks.every((c) => c.endsWith('\n\n'))).toBe(true);
  });
});

describe("kind: 'google' — request shaper", () => {
  test('routes to /models/{model}:generateContent, x-goog-api-key, model in URL not body', async () => {
    const port = startMock();
    const conn = createConnection({
      label: 'Gemini',
      kind: 'google',
      base_url: `http://127.0.0.1:${port}/v1beta`,
      api_key: 'AIza-test',
      model: 'gemini-2.5-flash',
    });
    activateConnection(conn.id);

    await generate({
      messages: [{ role: 'user', content: 'hello' }],
      stream: false,
    });

    expect(captured.url).toBe('/v1beta/models/gemini-2.5-flash:generateContent');
    expect(captured.headers!['x-goog-api-key']).toBe('AIza-test');
    expect(captured.headers!['authorization']).toBeUndefined();

    // Model is NOT in the body — it's in the URL.
    expect(captured.body.model).toBeUndefined();
  });

  test('reshapes messages: assistant→model, content→parts, system→systemInstruction', async () => {
    const port = startMock();
    const conn = createConnection({
      label: 'Gemini',
      kind: 'google',
      base_url: `http://127.0.0.1:${port}/v1beta`,
      model: 'gemini-2.5-flash',
    });
    activateConnection(conn.id);

    await generate({
      messages: [
        { role: 'system', content: 'Be helpful.' },
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello!' },
        { role: 'user', content: 'bye' },
      ],
      stream: false,
    });

    // System → systemInstruction.parts
    expect(captured.body.systemInstruction).toEqual({ parts: [{ text: 'Be helpful.' }] });

    // contents: assistant becomes 'model', content becomes parts: [{text}]
    expect(captured.body.contents).toEqual([
      { role: 'user', parts: [{ text: 'hi' }] },
      { role: 'model', parts: [{ text: 'hello!' }] },
      { role: 'user', parts: [{ text: 'bye' }] },
    ]);

    // No system role inside contents.
    expect(captured.body.contents.every((c: any) => c.role !== 'system')).toBe(true);
  });

  test('safetySettings defaults to BLOCK_NONE — the whole point of native', async () => {
    const port = startMock();
    const conn = createConnection({
      label: 'Gemini',
      kind: 'google',
      base_url: `http://127.0.0.1:${port}/v1beta`,
      model: 'gemini-2.5-flash',
    });
    activateConnection(conn.id);

    await generate({
      messages: [{ role: 'user', content: 'x' }],
      stream: false,
    });

    expect(captured.body.safetySettings).toHaveLength(4);
    expect(captured.body.safetySettings.every((s: any) => s.threshold === 'BLOCK_NONE')).toBe(true);
    const cats = captured.body.safetySettings.map((s: any) => s.category);
    expect(cats).toContain('HARM_CATEGORY_HARASSMENT');
    expect(cats).toContain('HARM_CATEGORY_SEXUALLY_EXPLICIT');
  });

  test('safetySettings overridable via extra_body', async () => {
    const port = startMock();
    const conn = createConnection({
      label: 'Gemini',
      kind: 'google',
      base_url: `http://127.0.0.1:${port}/v1beta`,
      model: 'gemini-2.5-flash',
      extra_body: {
        safetySettings: [{ category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_LOW_AND_ABOVE' }],
      },
    });
    activateConnection(conn.id);

    await generate({
      messages: [{ role: 'user', content: 'x' }],
      stream: false,
    });

    expect(captured.body.safetySettings).toEqual([
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
    ]);
  });

  test('samplers nest under generationConfig with renamed keys', async () => {
    const port = startMock();
    const conn = createConnection({
      label: 'Gemini',
      kind: 'google',
      base_url: `http://127.0.0.1:${port}/v1beta`,
      model: 'gemini-2.5-flash',
    });
    activateConnection(conn.id);

    await generate({
      messages: [{ role: 'user', content: 'x' }],
      stream: false,
      temperature: 0.7,
      top_p: 0.95,
      top_k: 40,
      max_tokens: 2048,
    });

    expect(captured.body.generationConfig).toEqual({
      temperature: 0.7,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 2048,
    });

    // OAI names do NOT leak to top-level — Gemini 400s on unknown keys.
    expect(captured.body.temperature).toBeUndefined();
    expect(captured.body.top_p).toBeUndefined();
    expect(captured.body.max_tokens).toBeUndefined();
  });

  test('streaming uses :streamGenerateContent?alt=sse', async () => {
    const port = startMock();
    const conn = createConnection({
      label: 'Gemini',
      kind: 'google',
      base_url: `http://127.0.0.1:${port}/v1beta`,
      model: 'gemini-2.5-flash',
    });
    activateConnection(conn.id);

    const chunks: string[] = [];
    for await (const c of generateStream({ messages: [{ role: 'user', content: 'x' }] })) {
      chunks.push(c);
    }

    expect(captured.url).toBe('/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse');
  });
});

describe("kind: 'google' — stream parser", () => {
  test('reshapes candidates[].content.parts into OAI deltas, synthesizes [DONE]', async () => {
    const port = startMock();
    const conn = createConnection({
      label: 'Gemini',
      kind: 'google',
      base_url: `http://127.0.0.1:${port}/v1beta`,
      model: 'gemini-2.5-flash',
    });
    activateConnection(conn.id);

    const chunks: string[] = [];
    for await (const c of generateStream({ messages: [{ role: 'user', content: 'x' }] })) {
      chunks.push(c);
    }
    const joined = chunks.join('');

    // Text in OAI delta shape.
    expect(joined).toContain('"delta":{"content":"Hello"}');
    expect(joined).toContain('"delta":{"content":" world"}');
    expect(joined).toContain('"delta":{"content":"!"}');

    // finishReason: STOP → finish_reason: stop
    expect(joined).toContain('"finish_reason":"stop"');

    // Usage remapped: candidatesTokenCount → completion_tokens
    expect(joined).toContain('"completion_tokens":3');

    // Gemini doesn't send [DONE] — we synthesize it.
    expect(joined).toContain('data: [DONE]');

    // Native shape doesn't leak.
    expect(joined).not.toContain('candidates');
    expect(joined).not.toContain('usageMetadata');

    expect(chunks.every((c) => c.endsWith('\n\n'))).toBe(true);
  });
});

describe("kind: 'openai' — default behavior preserved", () => {
  test('createConnection without kind defaults to openai', () => {
    const conn = createConnection({
      label: 'Default',
      base_url: 'http://x/v1',
      model: 'm',
    });
    expect(conn.kind).toBe('openai');
  });

  test('still routes to /chat/completions with Bearer', async () => {
    const port = startMock();
    const conn = createConnection({
      label: 'OAI',
      // no kind → defaults to 'openai'
      base_url: `http://127.0.0.1:${port}/v1`,
      api_key: 'sk-test',
      model: 'gpt-4',
    });
    activateConnection(conn.id);

    await generate({
      messages: [{ role: 'system', content: 'sys' }, { role: 'user', content: 'hi' }],
      stream: false,
    });

    expect(captured.url).toBe('/v1/chat/completions');
    expect(captured.headers!['authorization']).toBe('Bearer sk-test');

    // System message stays in messages[] — OAI accepts it there.
    expect(captured.body.messages).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hi' },
    ]);
    expect(captured.body.system).toBeUndefined();
  });
});

describe('testConnection — kind dispatch', () => {
  test('anthropic: x-api-key + anthropic-version on /models', async () => {
    const port = startMock();
    const conn = createConnection({
      label: 'Anthropic',
      kind: 'anthropic',
      base_url: `http://127.0.0.1:${port}/v1`,
      api_key: 'sk-ant-test',
      model: 'claude-opus-4-5',
    });

    const result = await testConnection(conn.id);
    expect(result.ok).toBe(true);
    expect(captured.headers!['x-api-key']).toBe('sk-ant-test');
    expect(captured.headers!['anthropic-version']).toBe('2023-06-01');
    expect(captured.headers!['authorization']).toBeUndefined();
  });

  test('google: key in query string, strips models/ prefix from results', async () => {
    const port = startMock();
    const conn = createConnection({
      label: 'Gemini',
      kind: 'google',
      base_url: `http://127.0.0.1:${port}/v1beta`,
      api_key: 'AIza-test',
      model: 'gemini-2.5-flash',
    });

    const result = await testConnection(conn.id);
    expect(result.ok).toBe(true);
    expect(captured.url).toContain('?key=AIza-test');
    // {name: 'models/gemini-test'} → 'gemini-test'
    expect(result.models).toContain('gemini-test');
  });

  test('openai: Bearer auth (unchanged)', async () => {
    const port = startMock();
    const conn = createConnection({
      label: 'OAI',
      base_url: `http://127.0.0.1:${port}/v1`,
      api_key: 'sk-test',
      model: 'gpt-4',
    });

    const result = await testConnection(conn.id);
    expect(result.ok).toBe(true);
    expect(captured.headers!['authorization']).toBe('Bearer sk-test');
  });
});

describe('catalog', () => {
  test('curated providers exist with correct kinds', () => {
    const cat = getCatalog();

    const anthropic = cat.find((p) => p.id === 'anthropic');
    expect(anthropic?.kind).toBe('anthropic');
    expect(anthropic?.base_url).toBe('https://api.anthropic.com/v1');
    expect(anthropic?.key_header).toBe('x-api-key');
    expect(anthropic?.models.length).toBeGreaterThan(0);

    const google = cat.find((p) => p.id === 'google');
    expect(google?.kind).toBe('google');
    expect(google?.key_header).toBe('x-goog-api-key');

    const openrouter = cat.find((p) => p.id === 'openrouter');
    expect(openrouter?.kind).toBe('openai');
    expect(openrouter?.key_header).toBeUndefined(); // default Bearer

    // Local servers: openai kind, empty model lists
    const ollama = cat.find((p) => p.id === 'ollama');
    expect(ollama?.kind).toBe('openai');
    expect(ollama?.base_url).toBe('http://127.0.0.1:11434/v1');
    expect(ollama?.models).toEqual([]);
  });

  test('models sorted newest-first', () => {
    const anthropic = getProvider('anthropic')!;
    for (let i = 1; i < anthropic.models.length; i++) {
      const prev = anthropic.models[i - 1]!.release ?? '';
      const curr = anthropic.models[i]!.release ?? '';
      expect(prev >= curr).toBe(true);
    }
  });

  test('findModel locates a model within a provider', () => {
    const anthropic = getProvider('anthropic')!;
    const someModel = anthropic.models[0]!;
    const found = findModel('anthropic', someModel.id);
    expect(found).toEqual(someModel);

    expect(findModel('anthropic', 'nonexistent-model')).toBeUndefined();
    expect(findModel('nonexistent-provider', 'whatever')).toBeUndefined();
  });
});

describe('createFromCatalog', () => {
  test('pre-fills kind, base_url, model from catalog provider', () => {
    const conn = createFromCatalog('anthropic', { api_key: 'sk-ant-mykey' });

    expect(conn.kind).toBe('anthropic');
    expect(conn.base_url).toBe('https://api.anthropic.com/v1');
    expect(conn.label).toBe('Anthropic');
    expect(conn.api_key).toBe('sk-ant-mykey');
    // model = first (newest) in catalog
    const newest = getProvider('anthropic')!.models[0]!.id;
    expect(conn.model).toBe(newest);
  });

  test('label override', () => {
    const conn = createFromCatalog('openrouter', { label: 'My OR Key' });
    expect(conn.label).toBe('My OR Key');
    expect(conn.kind).toBe('openai');
  });

  test('local provider: empty model string (discovered live)', () => {
    const conn = createFromCatalog('ollama');
    expect(conn.kind).toBe('openai');
    expect(conn.base_url).toBe('http://127.0.0.1:11434/v1');
    expect(conn.model).toBe(''); // models[0]?.id ?? ''
  });

  test('unknown provider → 400', () => {
    expect(() => createFromCatalog('made-up-provider')).toThrow(
      expect.objectContaining({ code: 'UNKNOWN_PROVIDER', status: 400 }),
    );
  });

  test('not idempotent — two calls = two rows', () => {
    const a = createFromCatalog('deepseek');
    const b = createFromCatalog('deepseek');
    expect(a.id).not.toBe(b.id);
    expect(getConnection(a.id)).not.toBeNull();
    expect(getConnection(b.id)).not.toBeNull();
  });
});

describe('migration 002', () => {
  test('CHECK constraint rejects invalid kind', () => {
    expect(() =>
      createConnection({
        label: 'Bad',
        kind: 'bedrock' as any, // not in CHECK enum
        base_url: 'http://x/v1',
        model: 'm',
      }),
    ).toThrow(/CHECK constraint/);
  });

  test('updateConnection patches kind', () => {
    const { updateConnection } = require('../../src/core/connections.ts');
    const conn = createConnection({
      label: 'Test',
      base_url: 'http://x/v1',
      model: 'm',
    });
    expect(conn.kind).toBe('openai');

    const updated = updateConnection(conn.id, { kind: 'anthropic' });
    expect(updated.kind).toBe('anthropic');
  });
});
