// ───────────────────────────────────────────────────────────────────────────
// Elysia → Express compatibility shim.
//
// The codebase was written against Elysia (a Bun-only web framework). To run
// on Node (and therefore Termux), we moved to Express. Rather than rewrite all
// twelve route files, this module re-implements just the slice of Elysia's API
// they use, on top of Express:
//
//   • `new Elysia({ prefix, tags })` with `.get/.post/.patch/.put/.delete`,
//     `.use(child)`, `.onBeforeHandle()`, `.onError()`.
//   • Handler context: { params, query, body, request, set, status, bearer }.
//   • Return values: a plain object/array (→ JSON), a web `Response`
//     (→ piped, used for SSE streaming and PNG export), a `file(path)` marker
//     (→ served from disk), or `status(code, body)`.
//   • `t.*` validators are accepted but NOT enforced — this is a single-user
//     local app and the bundled frontend always sends well-formed payloads.
//     Validation was Elysia's job; we drop it rather than port TypeBox.
//
// Multipart uploads (avatars, backgrounds, attachments) arrive via multer and
// are reshaped into web-`File`-like objects so the original handler code
// (`body.avatar.arrayBuffer()`, `.size`, `.name`, `.type`) keeps working.
// ───────────────────────────────────────────────────────────────────────────

import express, {
  type Express,
  type Request as ExRequest,
  type Response as ExResponse,
  type NextFunction,
} from 'express';
import multer from 'multer';
import { Readable } from 'node:stream';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname } from 'node:path';

// ── `t` — accepted, not enforced ───────────────────────────────────────────
// Every t.X(...) just returns an opaque marker. Routes pass these in their
// options object; we ignore them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SchemaFn = (...a: any[]) => any;
// The methods our schemas call. All return an opaque marker; types are `any`
// so existing `t.Object({...})` call-sites compile unchanged.
export interface TBuilder {
  Object: SchemaFn;
  Array: SchemaFn;
  String: SchemaFn;
  Number: SchemaFn;
  Numeric: SchemaFn;
  Boolean: SchemaFn;
  Optional: SchemaFn;
  Nullable: SchemaFn;
  Union: SchemaFn;
  Literal: SchemaFn;
  Record: SchemaFn;
  Unknown: SchemaFn;
  Partial: SchemaFn;
  File: SchemaFn;
  [k: string]: SchemaFn;
}
const schemaMarker: SchemaFn = (..._args: unknown[]) => ({ __schema: true });
export const t: TBuilder = new Proxy({}, { get: () => schemaMarker }) as TBuilder;


// ── File wrapper (web File-like over a multer buffer) ───────────────────────
class UploadFile {
  constructor(
    private buf: Buffer,
    public name: string,
    public type: string,
  ) {}
  get size(): number {
    return this.buf.length;
  }
  async arrayBuffer(): Promise<ArrayBuffer> {
    return this.buf.buffer.slice(
      this.buf.byteOffset,
      this.buf.byteOffset + this.buf.byteLength,
    ) as ArrayBuffer;
  }
  async text(): Promise<string> {
    return this.buf.toString('utf8');
  }
}


// ── file(path) marker for serving a file from disk ──────────────────────────
const FILE_MARKER = Symbol('file');
export function file(path: string): { [FILE_MARKER]: string } {
  return { [FILE_MARKER]: path };
}

// ── Context types ───────────────────────────────────────────────────────────
// Deliberately loose (`any` for params/query/body). The original Elysia code
// relied on per-route TypeBox schemas to type these; we dropped validation, so
// we keep the ergonomics by letting handlers destructure freely.
export interface Ctx {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
  request: { signal: AbortSignal; method: string; url: string };
  set: { status: number; headers: Record<string, string> };
  status: (code: number, body?: unknown) => StatusResult;
  bearer: string | undefined;
}

type Handler = (ctx: Ctx) => unknown | Promise<unknown>;
type BeforeHandle = (ctx: Ctx) => unknown | Promise<unknown>;
type RouteOpts = Record<string, unknown>;

type ErrorHandler = (info: {
  error: unknown;
  code: string;
  set: { status: number; headers: Record<string, string> };
  request: { method: string; url: string };
  path: string;
}) => unknown;

interface StatusResult {
  __status: number;
  body: unknown;
}

interface RouteDef {
  method: 'get' | 'post' | 'patch' | 'put' | 'delete';
  path: string;
  handler: Handler;
  hasUpload: boolean;
}

// ── Elysia shim ─────────────────────────────────────────────────────────────
export class Elysia {
  prefix: string;
  routes: RouteDef[] = [];
  children: Elysia[] = [];
  beforeHandlers: BeforeHandle[] = [];
  errorHandler?: ErrorHandler;

  constructor(opts?: { prefix?: string; tags?: unknown }) {
    this.prefix = opts?.prefix ?? '';
  }

  private add(
    method: RouteDef['method'],
    path: string,
    handler: Handler,
    opts?: RouteOpts,
  ): this {
    // A route accepts an upload if its declared body schema mentions a file.
    // We can't introspect the opaque markers, so flag routes whose body option
    // exists; multer is harmless on non-multipart requests anyway.
    const hasUpload = !!opts && 'body' in (opts ?? {});
    this.routes.push({ method, path, handler, hasUpload });
    return this;
  }

  get(path: string, handler: Handler, opts?: RouteOpts): this {
    return this.add('get', path, handler, opts);
  }
  post(path: string, handler: Handler, opts?: RouteOpts): this {
    return this.add('post', path, handler, opts);
  }
  patch(path: string, handler: Handler, opts?: RouteOpts): this {
    return this.add('patch', path, handler, opts);
  }
  put(path: string, handler: Handler, opts?: RouteOpts): this {
    return this.add('put', path, handler, opts);
  }
  delete(path: string, handler: Handler, opts?: RouteOpts): this {
    return this.add('delete', path, handler, opts);
  }


  use(child: Elysia): this {
    if (child instanceof Elysia) this.children.push(child);
    return this;
  }

  onBeforeHandle(fn: BeforeHandle): this {
    this.beforeHandlers.push(fn);
    return this;
  }

  onError(fn: ErrorHandler): this {
    this.errorHandler = fn;
    return this;
  }

  /** Flatten this tree into concrete routes, accumulating prefixes + hooks. */
  collect(
    parentPrefix = '',
    inheritedBefore: BeforeHandle[] = [],
  ): {
    routes: Array<{ route: RouteDef; before: BeforeHandle[] }>;
    errorHandler?: ErrorHandler;
  } {
    const prefix = parentPrefix + this.prefix;
    const before = [...inheritedBefore, ...this.beforeHandlers];
    const out: Array<{ route: RouteDef; before: BeforeHandle[] }> = [];
    let errorHandler = this.errorHandler;

    for (const route of this.routes) {
      out.push({
        route: { ...route, path: prefix + route.path },
        before,
      });
    }
    for (const child of this.children) {
      const sub = child.collect(prefix, before);
      out.push(...sub.routes);
      if (sub.errorHandler) errorHandler = sub.errorHandler;
    }
    return { routes: out, errorHandler };
  }
}

const upload = multer({ storage: multer.memoryStorage() });

function bearerFrom(req: ExRequest): string | undefined {
  const h = req.headers['authorization'];
  if (typeof h === 'string' && h.startsWith('Bearer ')) return h.slice(7);
  return undefined;
}

  // The Express Response is needed to detect a real client disconnect; see
  // buildCtx. mountElysia passes it in.
function buildCtx(req: ExRequest, res: ExResponse, set: Ctx['set']): Ctx {
  // Bridge the express lifecycle to an AbortSignal so streaming handlers can
  // abort the upstream fetch when the client *actually* goes away.
  //
  // NOTE: we listen on the RESPONSE's 'close', not the request's. In modern
  // Node, `req`'s 'close' fires as soon as the request body has been fully
  // read — which for a normal parsed JSON POST is immediately — so the old
  // `req.on('close', abort)` aborted the upstream fetch ~2ms in, killing every
  // generation with "This operation was aborted". `res`'s 'close' only fires
  // when the socket closes; if the response already finished (`writableEnded`)
  // that's the normal end-of-request and we must NOT abort.
  const ac = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) ac.abort();
  });


  // Merge multipart files (from multer) into body as File-like objects.
  const body = (req.body ?? {}) as Record<string, unknown>;
  const files = (req as unknown as { files?: Express.Multer.File[] }).files;
  if (Array.isArray(files)) {
    for (const f of files) {
      body[f.fieldname] = new UploadFile(f.buffer, f.originalname, f.mimetype);
    }
  }

  return {
    params: req.params as Record<string, string>,
    query: req.query as Record<string, string | undefined>,
    body: body as Ctx['body'],
    request: { signal: ac.signal, method: req.method, url: req.originalUrl },
    set,
    status: (code: number, b?: unknown): StatusResult => ({ __status: code, body: b }),
    bearer: bearerFrom(req),
  };
}

async function sendResult(res: ExResponse, set: Ctx['set'], result: unknown): Promise<void> {
  // status(code, body)
  if (result && typeof result === 'object' && '__status' in result) {
    const r = result as StatusResult;
    applyHeaders(res, set);
    res.status(r.__status);
    sendBody(res, r.body);
    return;
  }

  // file(path)
  if (result && typeof result === 'object' && (result as Record<symbol, unknown>)[FILE_MARKER]) {
    const path = (result as Record<symbol, string>)[FILE_MARKER] as string;
    applyHeaders(res, set);

    if (!existsSync(path)) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'File not found' } });
      return;
    }
    if (!res.getHeader('content-type')) {
      res.type(extname(path) || 'application/octet-stream');
    }
    res.setHeader('content-length', statSync(path).size);
    createReadStream(path).pipe(res);
    return;
  }

  // web Response (SSE stream, PNG export, etc.)
  if (result instanceof Response) {
    res.status(result.status || set.status);
    result.headers.forEach((v, k) => res.setHeader(k, v));
    applyHeaders(res, set, /* onlyIfMissing */ true);
    if (result.body) {
      Readable.fromWeb(result.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res);
    } else {
      const buf = Buffer.from(await result.arrayBuffer());
      res.end(buf);
    }
    return;
  }

  // plain value
  applyHeaders(res, set);
  res.status(set.status);
  sendBody(res, result);
}

function sendBody(res: ExResponse, body: unknown): void {
  if (body === undefined || body === null) {
    res.json({});
  } else if (typeof body === 'string') {
    res.send(body);
  } else if (Buffer.isBuffer(body) || body instanceof Uint8Array) {
    res.end(Buffer.from(body as Uint8Array));
  } else {
    res.json(body);
  }
}

function applyHeaders(res: ExResponse, set: Ctx['set'], onlyIfMissing = false): void {
  for (const [k, v] of Object.entries(set.headers)) {
    if (onlyIfMissing && res.getHeader(k)) continue;
    res.setHeader(k, v);
  }
}

/**
 * Mount one or more Elysia route-trees onto an Express app. The first tree's
 * onError (if any) becomes the shared error handler; a global beforeHandle can
 * be supplied (used for bearer auth).
 */
export function mountElysia(
  app: Express,
  root: Elysia,
  globalBefore: BeforeHandle[] = [],
): void {
  const { routes, errorHandler } = root.collect();

  for (const { route, before } of routes) {
    const middlewares = route.hasUpload ? [upload.any()] : [];
    const allBefore = [...globalBefore, ...before];

    const handler = async (req: ExRequest, res: ExResponse, next: NextFunction) => {
      const set: Ctx['set'] = { status: 200, headers: {} };
      const ctx = buildCtx(req, res, set);

      try {
        for (const bh of allBefore) {
          const early = await bh(ctx);
          if (early !== undefined) {
            await sendResult(res, set, early);
            return;
          }
        }
        const result = await route.handler(ctx);
        await sendResult(res, set, result);
      } catch (err) {
        handleError(err, errorHandler, req, res, set);
      }
    };

    // Express path: Elysia uses `:param`, same as Express. Wildcards differ but
    // none of our routes use them (SPA fallback is handled separately).
    app[route.method](route.path, ...middlewares, handler);
  }
}

function handleError(
  err: unknown,
  errorHandler: ErrorHandler | undefined,
  req: ExRequest,
  res: ExResponse,
  set: Ctx['set'],
): void {
  if (errorHandler) {
    // Mimic Elysia's error `code`: we only meaningfully distinguish AppError
    // (handled inside the route's onError by instanceof) from the rest.
    const out = errorHandler({
      error: err,
      code: 'UNKNOWN',
      set,
      request: { method: req.method, url: req.originalUrl },
      path: req.path,
    });
    if (res.headersSent) return;
    applyHeaders(res, set);
    res.status(set.status || 500);
    sendBody(res, out);
    return;
  }
  console.error('✗', err);
  if (!res.headersSent) {
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } });
  }
}

export type App = Express;
