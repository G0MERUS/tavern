import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Server } from 'bun';

import { setupDb, teardownDb, FIXTURES } from '../setup.ts';
import { createConnection, activateConnection } from '../../src/core/connections.ts';
import { createPreset } from '../../src/core/presets.ts';
import { setSetting } from '../../src/core/settings.ts';
import { generate, generateStream } from '../../src/llm/generate.ts';

// Mock OAI-compat upstream. Captures what we send so we can verify the
// proxy correctly assembles preset params + extra_body + overrides with the
// right precedence — using actual Lucid Loom sampling values as the preset.

const lucidLoom = JSON.parse(readFileSync(join(FIXTURES, 'lucid-loom.json'), 'utf8'));

let mockServer: Server;
let captured: { body?: any; headers?: Record<string, string> } = {};

function startMock(): number {
  captured = {};
  mockServer = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === '/v1/models') {
        return Response.json({ data: [{ id: 'mock-model' }, { id: 'mock-model-2' }] });
      }

      if (url.pathname === '/v1/chat/completions') {
        captured.body = await req.json();
        captured.headers = Object.fromEntries(req.headers);

        if (captured.body.stream) {
          const enc = new TextEncoder();
          const stream = new ReadableStream({
            start(c) {
              c.enqueue(enc.encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'));
              c.enqueue(enc.encode('data: {"choices":[{"delta":{"content":" world"}}]}\n\n'));
              c.enqueue(enc.encode('data: [DONE]\n\n'));
              c.close();
            },
          });
          return new Response(stream, {
            headers: { 'Content-Type': 'text/event-stream' },
          });
        }

        return Response.json({
          id: 'mock-1',
          object: 'chat.completion',
          model: captured.body.model,
          choices: [{ index: 0, message: { role: 'assistant', content: 'mock reply' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        });
      }

      if (url.pathname === '/v1/error/chat/completions') {
        return new Response('{"error":"bad key"}', { status: 401 });
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

describe('generate — request assembly', () => {
  test('preset params + connection extras + overrides spread with correct precedence', async () => {
    const port = startMock();

    const conn = createConnection({
      label: 'Mock',
      base_url: `http://127.0.0.1:${port}/v1`,
      api_key: 'sk-test',
      model: 'mock-model',
      extra_headers: { 'X-Custom': 'header-value' },
      extra_body: { transforms: ['middle-out'], top_p: 0.5 }, // top_p collides with preset
    });
    activateConnection(conn.id);

    const preset = createPreset('Lucid', {
      temperature: lucidLoom.temperature,        // 1
      top_p: lucidLoom.top_p,                    // 0.97 — extra_body has 0.5
      frequency_penalty: lucidLoom.frequency_penalty,
      presence_penalty: lucidLoom.presence_penalty,
      max_tokens: lucidLoom.openai_max_tokens,   // 32768
    });
    setSetting('active_preset_id', preset.id);

    await generate({
      messages: [{ role: 'user', content: 'hello' }],
      stream: false,
      max_tokens: 100, // explicit override
    });

    const body = captured.body;

    // Precedence: preset < extra_body < explicit override.
    expect(body.temperature).toBe(1);
    expect(body.top_p).toBe(0.5);                 // extra_body wins over preset
    expect(body.max_tokens).toBe(100);            // explicit wins
    expect(body.transforms).toEqual(['middle-out']);
    expect(body.frequency_penalty).toBe(0);
    expect(body.model).toBe('mock-model');
    expect(body.messages).toEqual([{ role: 'user', content: 'hello' }]);
    expect(body.stream).toBe(false);

    expect(captured.headers!['authorization']).toBe('Bearer sk-test');
    expect(captured.headers!['x-custom']).toBe('header-value');
  });

  test('namespaced preset: unwraps samplers, omits defaults, drops metadata', async () => {
    const port = startMock();
    const conn = createConnection({
      label: 'Mock',
      base_url: `http://127.0.0.1:${port}/v1`,
      model: 'mock-model',
    });
    activateConnection(conn.id);

    // Frontend shape. prompts/prompt_order/templates/behavior are frontend
    // metadata — if they reach OpenAI it's a 400.
    const preset = createPreset('Namespaced', {
      samplers: {
        temperature: 0.85,                // touched → sent
        top_p: 1,                         // default → omitted
        top_k: 40,                        // touched → sent
        frequency_penalty: 0,             // default → omitted
        seed: -1,                         // default → omitted
        n: 1,                             // default → omitted
        repetition_penalty: 1,            // default → omitted
        openai_max_tokens: 32768,         // → max_tokens, always sent
        openai_max_context: 200000,       // budget hint, dropped
        max_context_unlocked: true,       // UI affordance, dropped
        stream: false,                    // envelope field, dropped
      },
      prompts: Array.from({ length: 12 }, (_, i) => ({
        identifier: `p${i}`, name: `Prompt ${i}`, content: 'x'.repeat(100),
      })),
      prompt_order: [{ character_id: 100000, order: [] }],
      templates: { wi_format: '{0}' },
      behavior: { names_behavior: 0 },
    });
    setSetting('active_preset_id', preset.id);

    await generate({
      messages: [{ role: 'user', content: 'hi' }],
      stream: false,
    });

    const body = captured.body;

    expect(body.temperature).toBe(0.85);
    expect(body.top_k).toBe(40);
    expect(body.max_tokens).toBe(32768);

    // Default-valued samplers are absent. (o1 rejects temperature; an
    // untouched preset works there because temperature=1 → omit.)
    expect(body.top_p).toBeUndefined();
    expect(body.frequency_penalty).toBeUndefined();
    expect(body.seed).toBeUndefined();
    expect(body.n).toBeUndefined();
    expect(body.repetition_penalty).toBeUndefined();

    // Frontend metadata stays out of the wire.
    expect(body.prompts).toBeUndefined();
    expect(body.prompt_order).toBeUndefined();
    expect(body.templates).toBeUndefined();
    expect(body.behavior).toBeUndefined();
    expect(body.samplers).toBeUndefined();

    expect(body.openai_max_context).toBeUndefined();
    expect(body.openai_max_tokens).toBeUndefined();
    expect(body.max_context_unlocked).toBeUndefined();

    // Preset's stream did NOT clobber explicit stream: false.
    expect(body.stream).toBe(false);
  });

  test('namespaced preset: unrecognized sampler keys pass through', async () => {
    const port = startMock();
    const conn = createConnection({
      label: 'Mock',
      base_url: `http://127.0.0.1:${port}/v1`,
      model: 'mock-model',
    });
    activateConnection(conn.id);

    // Forward-compat: ship a new sampler key without a backend deploy.
    const preset = createPreset('Future', {
      samplers: { openai_max_tokens: 4096, mirostat_tau: 5.0 },
    });
    setSetting('active_preset_id', preset.id);

    await generate({
      messages: [{ role: 'user', content: 'hi' }],
      stream: false,
    });

    expect(captured.body.mirostat_tau).toBe(5.0);
  });

  test('flat preset still works (back-compat)', async () => {
    const port = startMock();
    const conn = createConnection({
      label: 'Mock',
      base_url: `http://127.0.0.1:${port}/v1`,
      model: 'mock-model',
    });
    activateConnection(conn.id);

    // No `samplers` key → pass through verbatim.
    const preset = createPreset('Flat', {
      temperature: 0.6,
      top_p: 0.9,
      max_tokens: 4096,
    });
    setSetting('active_preset_id', preset.id);

    await generate({
      messages: [{ role: 'user', content: 'hi' }],
      stream: false,
    });

    expect(captured.body.temperature).toBe(0.6);
    expect(captured.body.top_p).toBe(0.9);
    expect(captured.body.max_tokens).toBe(4096);
  });

  test('no preset → just connection + overrides', async () => {
    const port = startMock();
    const conn = createConnection({
      label: 'Mock',
      base_url: `http://127.0.0.1:${port}/v1`,
      model: 'mock-model',
    });
    activateConnection(conn.id);
    setSetting('active_preset_id', null);

    await generate({
      messages: [{ role: 'user', content: 'hi' }],
      stream: false,
      temperature: 0.3,
    });

    expect(captured.body.temperature).toBe(0.3);
    expect(captured.body.top_p).toBeUndefined();
  });

  test('throws NO_CONNECTION when nothing active', async () => {
    setSetting('active_connection_id', null);

    expect(generate({
      messages: [{ role: 'user', content: 'hi' }],
      stream: false,
    })).rejects.toMatchObject({ code: 'NO_CONNECTION' });
  });
});

describe('generate — streaming', () => {
  test('passes SSE chunks through verbatim', async () => {
    const port = startMock();
    const conn = createConnection({
      label: 'Mock',
      base_url: `http://127.0.0.1:${port}/v1`,
      model: 'mock-model',
    });
    activateConnection(conn.id);

    const chunks: string[] = [];
    for await (const chunk of generateStream({
      messages: [{ role: 'user', content: 'stream' }],
    })) {
      chunks.push(chunk);
    }

    const joined = chunks.join('');
    expect(joined).toContain('"content":"Hello"');
    expect(joined).toContain('"content":" world"');
    expect(joined).toContain('[DONE]');
    expect(chunks.every((c) => c.endsWith('\n\n'))).toBe(true);
  });
});

describe('generate — error mapping', () => {
  test('upstream 401 → 502 UPSTREAM_AUTH (no browser auth dialog)', async () => {
    const port = startMock();
    const conn = createConnection({
      label: 'Bad',
      base_url: `http://127.0.0.1:${port}/v1/error`,
      model: 'x',
    });
    activateConnection(conn.id);

    const promise = generate({
      messages: [{ role: 'user', content: 'x' }],
      stream: false,
    });

    expect(promise).rejects.toMatchObject({
      code: 'UPSTREAM_AUTH',
      status: 502,
    });
  });

  test('unreachable upstream → 502 UPSTREAM_UNREACHABLE', async () => {
    // Port 1 is privileged and unbindable — connection refused immediately.
    const conn = createConnection({
      label: 'Dead',
      base_url: 'http://127.0.0.1:1/v1',
      model: 'x',
    });
    activateConnection(conn.id);

    expect(generate({
      messages: [{ role: 'user', content: 'x' }],
      stream: false,
    })).rejects.toMatchObject({ code: 'UPSTREAM_UNREACHABLE' });
  });
});

describe('connection test', () => {
  test('GET /models returns model list', async () => {
    const port = startMock();
    const conn = createConnection({
      label: 'Mock',
      base_url: `http://127.0.0.1:${port}/v1`,
      model: 'mock-model',
    });

    const { testConnection } = await import('../../src/llm/generate.ts');
    const result = await testConnection(conn.id);

    expect(result.ok).toBe(true);
    expect(result.models).toContain('mock-model');
    expect(result.models).toContain('mock-model-2');
  });
});
