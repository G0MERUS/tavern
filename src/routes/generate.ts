import { Elysia, t } from '../_compat/elysia.ts';

import { generate, generateStream } from '../llm/generate.ts';
import { countTokens } from '../llm/tokenize.ts';
import { AppError } from '../types.ts';

// /api/generate takes OAI-shaped messages and proxies to the active
// connection. The frontend assembles messages (character description →
// system msg, lorebook hits, chat history) because users want to see and
// edit the assembled prompt before sending. The backend is a dumb pipe.

const ContentPart = t.Union([
  t.Object({ type: t.Literal('text'), text: t.String() }),
  t.Object({
    type: t.Literal('image_url'),
    image_url: t.Object({ url: t.String(), detail: t.Optional(t.String()) }),
  }),
]);

const ChatMessage = t.Object({
  role: t.Union([t.Literal('system'), t.Literal('user'), t.Literal('assistant')]),
  content: t.Union([t.String(), t.Array(ContentPart)]),
  name: t.Optional(t.String()),
});

const GenerateBody = t.Object(
  {
    messages: t.Array(ChatMessage, { minItems: 1 }),
    stream: t.Optional(t.Boolean()),
    connection_id: t.Optional(t.String()),
    preset_id: t.Optional(t.String()),
    // Everything else passes through to the upstream body.
  },
  { additionalProperties: true },
);

export const generateRoutes = new Elysia({ prefix: '/api', tags: ['generation'] })
  .post(
    '/generate',
    async ({ body, request, status }) => {
      const stream = body.stream ?? true;

      if (!stream) {
        try {
          return (await generate(body, request.signal)) as object;
        } catch (err) {
          if (err instanceof AppError) {
            return status(err.status, {
              error: { code: err.code, message: err.message, ...(err.details as object) },
            });
          }
          throw err;
        }
      }

      // Streaming: our chunks ARE raw SSE frames (upstream already speaks
      // SSE; we re-shape Anthropic/Google to OAI shape but preserve the
      // `data: ...\n\n` framing, plus `event: error\ndata: ...` on upstream
      // failure). Elysia 1.4 auto-wraps every yield from a generator as an
      // SSE `data:` event, which would turn each frame into
      // `data: data: {...}` on the wire — the frontend's parser can't recover
      // and silently produces empty assistant messages. Return a raw Response
      // with a ReadableStream so Elysia doesn't reframe anything.
      const encoder = new TextEncoder();
      const iter = generateStream(body, request.signal);
      const readable = new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            const { done, value } = await iter.next();
            if (done) {
              controller.close();
              return;
            }
            controller.enqueue(encoder.encode(value));
          } catch (err) {
            controller.error(err);
          }
        },
        // Client disconnected → tell the generator so its finally{} aborts
        // the upstream fetch.
        async cancel() {
          await iter.return?.();
        },
      });

      return new Response(readable, {
        headers: {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache',
          'connection': 'keep-alive',
          'x-accel-buffering': 'no', // disable nginx buffering
        },
      });
    },
    { body: GenerateBody },
  )

  .post(
    '/tokenize',
    ({ body }) => ({ tokens: countTokens(body.text) }),
    { body: t.Object({ text: t.String() }) },
  );
