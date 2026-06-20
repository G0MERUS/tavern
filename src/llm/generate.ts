import { getActive as getActiveConnection, getConnection } from '../core/connections.ts';
import { getPreset } from '../core/presets.ts';
import { getSetting } from '../core/settings.ts';
import { getConfig } from '../config.ts';
import { AppError, type ChatMessage, type ConnectionRow, type ConnectionKind } from '../types.ts';

// The upstream proxy. Three request shapers dispatched on connections.kind:
//
// - 'openai'    — POST {base}/chat/completions, Bearer auth. Covers OpenAI,
//                 OpenRouter, DeepSeek, Groq, Mistral, xAI, Together,
//                 Fireworks, Perplexity, Moonshot, every local server, and
//                 the OAI shims on Anthropic/Gemini.
// - 'anthropic' — POST {base}/messages, x-api-key. Native gives us prompt
//                 caching (big input-cost reduction on cache hit) and
//                 extended thinking.
// - 'google'    — POST {base}/models/{model}:generateContent, x-goog-api-key.
//                 Native gives us safetySettings: BLOCK_NONE. The OAI shim
//                 doesn't expose it and the default filter blocks fiction.
//
// All three stream parsers re-emit OAI-shaped chunks so the frontend's SSE
// parser doesn't change.

export interface GenerateRequest {
  messages: ChatMessage[];
  stream?: boolean;
  connection_id?: string;
  preset_id?: string;
  /** Anything else (model, temperature, max_tokens, ...) gets spread into the body. */
  [key: string]: unknown;
}

interface BuiltRequest {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
  kind: ConnectionKind;
}

/** Resolved inputs to a shaper. Precedence: preset < extraBody < overrides. */
interface Resolved {
  conn: ConnectionRow;
  preset: Record<string, unknown>;
  extraBody: Record<string, unknown>;
  extraHeaders: Record<string, string>;
  overrides: Record<string, unknown>;
}

// Shared resolution. Keeps the three precedence layers separate so each
// shaper can interleave them with its own structural defaults. The upstream
// validates body shape; we don't.
function resolve(req: GenerateRequest): Resolved {
  const conn = req.connection_id
    ? getConnection(req.connection_id)
    : getActiveConnection();
  if (!conn) {
    throw new AppError(
      'NO_CONNECTION',
      'No active connection. Configure one under /api/connections.',
      400,
    );
  }

  const presetId = req.preset_id ?? getSetting<string>('active_preset_id');
  const presetRow = presetId ? getPreset(presetId) : null;
  const preset: Record<string, unknown> = presetRow
    ? extractSamplers(JSON.parse(presetRow.params))
    : {};

  // Anything that's not a control field is a body override.
  const { messages: _m, stream: _s, connection_id: _c, preset_id: _p, ...overrides } = req;

  return {
    conn,
    preset,
    extraBody: JSON.parse(conn.extra_body || '{}'),
    extraHeaders: JSON.parse(conn.extra_headers || '{}'),
    overrides,
  };
}

function buildRequest(req: GenerateRequest): BuiltRequest {
  const r = resolve(req);
  const stream = req.stream ?? true;
  switch (r.conn.kind) {
    case 'anthropic': return buildAnthropic(r, req.messages, stream);
    case 'google':    return buildGoogle(r, req.messages, stream);
    default:          return buildOpenAI(r, req.messages, stream);
  }
}

function buildOpenAI(r: Resolved, messages: ChatMessage[], stream: boolean): BuiltRequest {
  const body: Record<string, unknown> = {
    model: r.conn.model,
    messages,
    stream,
    ...r.preset,
    ...r.extraBody,
    ...r.overrides,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...r.extraHeaders,
  };
  if (r.conn.api_key) headers['Authorization'] = `Bearer ${r.conn.api_key}`;

  const base = r.conn.base_url.replace(/\/+$/, '');
  return { url: `${base}/chat/completions`, headers, body, kind: 'openai' };
}

/**
 * Anthropic: top-level `system`, max_tokens required, anthropic-version
 * header required.
 *
 * system: Anthropic rejects role:'system' inside messages[]. Pull them out,
 * concat with \n\n, send as a top-level string.
 *
 * max_tokens: required; Anthropic 400s without it. Fall back to 4096. (The
 * OAI shaper omits it when absent — Anthropic can't.)
 */
function buildAnthropic(r: Resolved, messages: ChatMessage[], stream: boolean): BuiltRequest {
  const systemParts: string[] = [];
  const convo: ChatMessage[] = [];
  for (const m of messages) {
    if (m.role === 'system') {
      systemParts.push(typeof m.content === 'string' ? m.content : textOf(m.content));
    } else {
      convo.push(m);
    }
  }

  // Pluck max_tokens out of merged params — it's structural for Anthropic,
  // not a sampler.
  const merged = { ...r.preset, ...r.extraBody, ...r.overrides };
  const { max_tokens, ...rest } = merged;

  const body: Record<string, unknown> = {
    model: r.conn.model,
    max_tokens: typeof max_tokens === 'number' ? max_tokens : 4096,
    messages: convo,
    stream,
    ...rest,
  };
  if (systemParts.length > 0) body['system'] = systemParts.join('\n\n');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
    ...r.extraHeaders,
  };
  if (r.conn.api_key) headers['x-api-key'] = r.conn.api_key;

  const base = r.conn.base_url.replace(/\/+$/, '');
  return { url: `${base}/messages`, headers, body, kind: 'anthropic' };
}

/**
 * Google Gemini: model in URL, `assistant` → `model`, system →
 * systemInstruction, content → parts:[{text}], samplers nested under
 * generationConfig. Safety defaults to BLOCK_NONE for all four categories.
 */
function buildGoogle(r: Resolved, messages: ChatMessage[], stream: boolean): BuiltRequest {
  const systemParts: { text: string }[] = [];
  const contents: { role: string; parts: { text: string }[] }[] = [];
  for (const m of messages) {
    const text = typeof m.content === 'string' ? m.content : textOf(m.content);
    if (m.role === 'system') {
      systemParts.push({ text });
    } else {
      contents.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text }],
      });
    }
  }

  // Map OAI sampler names → Gemini's generationConfig names. Anything we
  // don't recognize gets dropped — Gemini 400s on unknown top-level keys
  // and generationConfig is a closed schema.
  const merged = { ...r.preset, ...r.extraBody, ...r.overrides };
  const genCfg: Record<string, unknown> = {};
  if (typeof merged['temperature'] === 'number') genCfg['temperature'] = merged['temperature'];
  if (typeof merged['top_p'] === 'number') genCfg['topP'] = merged['top_p'];
  if (typeof merged['top_k'] === 'number') genCfg['topK'] = merged['top_k'];
  if (typeof merged['max_tokens'] === 'number') genCfg['maxOutputTokens'] = merged['max_tokens'];
  if (Array.isArray(merged['stop'])) genCfg['stopSequences'] = merged['stop'];

  // extra_body can override the BLOCK_NONE default.
  const safety = merged['safetySettings'] ?? GEMINI_SAFETY_OFF;

  const body: Record<string, unknown> = { contents };
  if (systemParts.length > 0) body['systemInstruction'] = { parts: systemParts };
  if (Object.keys(genCfg).length > 0) body['generationConfig'] = genCfg;
  body['safetySettings'] = safety;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...r.extraHeaders,
  };
  if (r.conn.api_key) headers['x-goog-api-key'] = r.conn.api_key;

  // Model goes in the URL path, not the body. Override-able via the usual
  // precedence chain.
  const model = typeof merged['model'] === 'string' ? merged['model'] : r.conn.model;
  const base = r.conn.base_url.replace(/\/+$/, '');
  const verb = stream ? 'streamGenerateContent?alt=sse' : 'generateContent';
  const url = `${base}/models/${encodeURIComponent(model)}:${verb}`;

  return { url, headers, body, kind: 'google' };
}

const GEMINI_SAFETY_OFF = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];

/**
 * Flatten ContentPart[] to a single string. Only text parts are handled —
 * image proxying through native Anthropic/Gemini is a separate project.
 */
function textOf(parts: { type: string; text?: string }[]): string {
  return parts.filter((p) => p.type === 'text').map((p) => p.text ?? '').join('');
}

/**
 * Non-streaming generation. Returns the full upstream response body.
 * 401 from upstream maps to 502 — we're a bad gateway when the upstream
 * rejects our auth, and 401 in the browser triggers the HTTP Basic Auth dialog.
 */
export async function generate(req: GenerateRequest, signal?: AbortSignal): Promise<unknown> {
  const { url, headers, body } = buildRequest({ ...req, stream: false });

  const timeoutMs = getConfig().generateTimeout * 1000;
  const composed = composeSignals(signal, AbortSignal.timeout(timeoutMs));

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: composed,
      ...proxyOpts(),
    });
  } catch (err) {
    throw mapNetworkError(err);
  }

  if (!res.ok) throw await mapHttpError(res);
  return res.json();
}

/**
 * Streaming generation. Yields OAI-shaped SSE chunks regardless of upstream
 * kind. Anthropic/Google chunks get reshaped before yield; OpenAI chunks pass
 * through verbatim.
 *
 * Cancellation: client disconnects → Elysia stops iterating → finally{}
 * fires → AbortController fires → upstream fetch closes.
 */
export async function* generateStream(
  req: GenerateRequest,
  clientSignal?: AbortSignal,
): AsyncGenerator<string, void> {
  const { url, headers, body, kind } = buildRequest({ ...req, stream: true });

  const timeoutMs = getConfig().generateTimeout * 1000;
  const ctrl = new AbortController();
  const composed = composeSignals(clientSignal, AbortSignal.timeout(timeoutMs), ctrl.signal);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: composed,
      ...proxyOpts(),
    });
  } catch (err) {
    yield sseError(mapNetworkError(err));
    return;
  }

  if (!res.ok) {
    yield sseError(await mapHttpError(res));
    return;
  }

  if (!res.body) {
    yield sseError(new AppError('UPSTREAM_ERROR', 'Upstream returned no body', 502));
    return;
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  try {
    switch (kind) {
      case 'anthropic': yield* parseAnthropicStream(reader); break;
      case 'google':    yield* parseGoogleStream(reader); break;
      default:          yield* parseOpenAIStream(reader); break;
    }
  } finally {
    // Client bailed mid-stream → tell the upstream.
    ctrl.abort();
    reader.cancel().catch(() => {});
  }
}

/**
 * Structural reader type. Bun's ReadableStreamDefaultReader and Node's
 * web-stream version disagree on `readMany`; we need neither.
 */
type TextReader = {
  read(): Promise<{ done: boolean; value?: string }>;
};

/** Pass-through. Buffer on event boundaries so we never emit a partial. */
async function* parseOpenAIStream(reader: TextReader): AsyncGenerator<string, void> {
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const ev of events) {
      if (ev) yield ev + '\n\n';
    }
  }
  if (buffer.trim()) yield buffer + '\n\n';
}

/**
 * Anthropic SSE: each event is `event: <type>\ndata: <json>`. We care about:
 *   content_block_delta → text → re-emit as OAI delta
 *   message_delta       → usage → re-emit as OAI usage chunk
 *   message_stop        → done → emit [DONE]
 * Ignore: message_start, content_block_start, content_block_stop, ping.
 */
async function* parseAnthropicStream(reader: TextReader): AsyncGenerator<string, void> {
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';

    for (const ev of events) {
      if (!ev.trim()) continue;

      let type = '';
      let dataLine = '';
      for (const line of ev.split('\n')) {
        if (line.startsWith('event:')) type = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLine = line.slice(5).trim();
      }

      if (type === 'content_block_delta') {
        const text = safeJson(dataLine)?.delta?.text;
        if (typeof text === 'string') {
          yield oaiDelta(text);
        }
      } else if (type === 'message_delta') {
        // Usage lives here. input_tokens came on message_start (which we
        // skipped); the frontend mostly cares about completion tokens for
        // the live counter.
        const d = safeJson(dataLine);
        const usage = d?.usage;
        if (usage) {
          yield `data: ${JSON.stringify({
            choices: [{ delta: {}, finish_reason: d?.delta?.stop_reason ?? 'stop' }],
            usage: {
              prompt_tokens: usage.input_tokens ?? 0,
              completion_tokens: usage.output_tokens ?? 0,
              total_tokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
            },
          })}\n\n`;
        }
      } else if (type === 'message_stop') {
        yield 'data: [DONE]\n\n';
      } else if (type === 'error') {
        const err = safeJson(dataLine)?.error;
        yield sseError(new AppError(
          'UPSTREAM_ERROR',
          err?.message ?? 'Anthropic stream error',
          502,
          err,
        ));
      }
      // ping, message_start, content_block_start/stop: ignore.
    }
  }
  // Anthropic always sends message_stop. Any trailing buffer is a stranded
  // partial we can't safely re-emit.
}

/**
 * Gemini SSE (with ?alt=sse): each chunk is `data: <json>` with shape
 * {candidates: [{content: {parts: [{text}]}, finishReason?}], usageMetadata?}.
 * Re-emit text deltas in OAI shape. finishReason on the last chunk → [DONE].
 */
async function* parseGoogleStream(reader: TextReader): AsyncGenerator<string, void> {
  let buffer = '';
  let finished = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';

    for (const ev of events) {
      const trimmed = ev.trim();
      if (!trimmed) continue;
      const dataLine = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
      const chunk = safeJson(dataLine);
      if (!chunk) continue;

      // Surface upstream errors mid-stream.
      if (chunk.error) {
        yield sseError(new AppError(
          'UPSTREAM_ERROR',
          chunk.error.message ?? 'Gemini stream error',
          502,
          chunk.error,
        ));
        continue;
      }

      const cand = chunk.candidates?.[0];
      const parts = cand?.content?.parts;
      if (Array.isArray(parts)) {
        const text = parts.map((p: any) => p?.text ?? '').join('');
        if (text) yield oaiDelta(text);
      }

      if (cand?.finishReason) {
        const usage = chunk.usageMetadata;
        yield `data: ${JSON.stringify({
          choices: [{ delta: {}, finish_reason: mapGeminiFinish(cand.finishReason) }],
          ...(usage && {
            usage: {
              prompt_tokens: usage.promptTokenCount ?? 0,
              completion_tokens: usage.candidatesTokenCount ?? 0,
              total_tokens: usage.totalTokenCount ?? 0,
            },
          }),
        })}\n\n`;
        finished = true;
      }
    }
  }

  // Gemini doesn't send a [DONE] sentinel. Synthesize one.
  void finished;
  yield 'data: [DONE]\n\n';
}

function oaiDelta(text: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
}

function safeJson(s: string): any {
  try { return JSON.parse(s); } catch { return null; }
}

function mapGeminiFinish(reason: string): string {
  switch (reason) {
    case 'STOP': return 'stop';
    case 'MAX_TOKENS': return 'length';
    case 'SAFETY':
    case 'RECITATION': return 'content_filter';
    default: return reason.toLowerCase();
  }
}

/** Dispatches on kind: different auth headers, but every provider has a /models endpoint. */
export async function testConnection(connectionId: string): Promise<{
  ok: boolean;
  models?: string[];
  error?: string;
}> {
  const conn = getConnection(connectionId);
  if (!conn) return { ok: false, error: 'Connection not found' };

  const base = conn.base_url.replace(/\/+$/, '');
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...JSON.parse(conn.extra_headers || '{}'),
  };

  let url = `${base}/models`;
  switch (conn.kind) {
    case 'anthropic':
      if (conn.api_key) headers['x-api-key'] = conn.api_key;
      headers['anthropic-version'] = '2023-06-01';
      break;
    case 'google':
      // Google's documented happy path: key in query string.
      if (conn.api_key) url += `?key=${encodeURIComponent(conn.api_key)}`;
      break;
    default:
      if (conn.api_key) headers['Authorization'] = `Bearer ${conn.api_key}`;
  }

  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10_000),
      ...proxyOpts(),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `${res.status} ${res.statusText}: ${text.slice(0, 300)}` };
    }

    const json: any = await res.json();
    // OAI: {data: [{id}]}. Anthropic: {data: [{id}]}. Gemini:
    // {models: [{name: 'models/gemini-...'}]}.
    let list: any[] = [];
    if (Array.isArray(json?.data)) list = json.data;
    else if (Array.isArray(json?.models)) list = json.models;
    else if (Array.isArray(json)) list = json;

    const models = list
      .map((m: any) => {
        if (typeof m === 'string') return m;
        if (typeof m?.id === 'string') return m.id;
        // Gemini: {name: 'models/gemini-2.5-flash'} — strip prefix.
        if (typeof m?.name === 'string') return m.name.replace(/^models\//, '');
        return null;
      })
      .filter((m: any): m is string => typeof m === 'string');

    return { ok: true, models };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// The frontend stores presets namespaced: {samplers, prompts[], prompt_order,
// templates, behavior}. Spreading that verbatim ships 300+ prompt definitions
// to OpenAI.
//
// Contract: default = absent. A sampler at its default value doesn't go on
// the wire, so the smallest request can't trip a constraint the user didn't
// opt into (e.g. o1 rejects temperature; an untouched preset works there
// because temperature=1 → omit).
//
// max_tokens is the exception: a cap, not a sampler. Anthropic native
// requires it; OAI defaults to a small value. Always send.
//
// Old flat presets ({temperature: 0.8} at top level, no `samplers`) pass
// through unchanged — they predate this contract.

/** Wire-format defaults. Match = omit. */
const SAMPLER_DEFAULTS: Record<string, number> = {
  temperature: 1,
  top_p: 1,
  top_k: 0,
  min_p: 0,
  top_a: 0,
  frequency_penalty: 0,
  presence_penalty: 0,
  repetition_penalty: 1,
  seed: -1,
  n: 1,
};

function extractSamplers(params: Record<string, unknown>): Record<string, unknown> {
  if (!params || typeof params !== 'object') return {};

  const s = params['samplers'];
  if (!s || typeof s !== 'object') {
    // Flat preset. Pass through.
    return params;
  }

  const sam = s as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  if (sam['openai_max_tokens'] !== undefined) {
    out['max_tokens'] = sam['openai_max_tokens'];
  }

  for (const [key, def] of Object.entries(SAMPLER_DEFAULTS)) {
    const v = sam[key];
    if (v !== undefined && v !== def) out[key] = v;
  }

  // Unrecognized keys pass through. Lets us ship a new sampler without a
  // backend deploy; the default-omission contract still holds because the
  // frontend won't store unrecognized keys at their default.
  for (const [key, v] of Object.entries(sam)) {
    if (key in SAMPLER_DEFAULTS) continue;
    if (key === 'openai_max_tokens' || key === 'openai_max_context' ||
        key === 'max_context_unlocked' || key === 'stream') continue;
    out[key] = v;
  }

  return out;
}

function mapNetworkError(err: unknown): AppError {
  const e = err as Error;
  if (e.name === 'TimeoutError' || e.name === 'AbortError') {
    return new AppError('UPSTREAM_TIMEOUT', 'Upstream request timed out', 504);
  }
  return new AppError('UPSTREAM_UNREACHABLE', `Cannot reach upstream: ${e.message}`, 502);
}

async function mapHttpError(res: Response): Promise<AppError> {
  const text = await res.text().catch(() => '');
  const detail = text.slice(0, 500);

  if (res.status === 401) {
    // 401 → 502: don't trigger the browser HTTP Basic Auth dialog.
    return new AppError('UPSTREAM_AUTH', `Upstream rejected auth: ${detail}`, 502, {
      upstream_status: 401,
    });
  }
  if (res.status === 429) {
    const retryAfter = res.headers.get('retry-after');
    return new AppError('UPSTREAM_RATE_LIMIT', `Rate limited: ${detail}`, 429, {
      retry_after: retryAfter ? parseInt(retryAfter, 10) : undefined,
    });
  }
  if (res.status >= 500) {
    return new AppError('UPSTREAM_ERROR', `Upstream error ${res.status}: ${detail}`, 502, {
      upstream_status: res.status,
    });
  }
  return new AppError(
    'UPSTREAM_REJECTED',
    `Upstream rejected request (${res.status}): ${detail}`,
    502,
    { upstream_status: res.status, body: detail },
  );
}

function sseError(err: AppError): string {
  return `event: error\ndata: ${JSON.stringify({
    error: { code: err.code, message: err.message, ...err.details as object },
  })}\n\n`;
}

/** Combine multiple AbortSignals; aborts when any fires. */
function composeSignals(...signals: (AbortSignal | undefined)[]): AbortSignal {
  const real = signals.filter((s): s is AbortSignal => !!s);
  if (real.length === 0) return new AbortController().signal;
  if (real.length === 1) return real[0]!;
  return AbortSignal.any(real);
}

/** Bun-specific: outbound proxy for the upstream fetch. */
function proxyOpts(): { proxy?: string } {
  const p = getConfig().outboundProxy;
  return p ? { proxy: p } : {};
}
