import { createServer, type Server as HttpServer } from 'node:http';
import { Readable } from 'node:stream';


// Bun.serve replacement for tests. The integration tests were written against
// Bun's `Bun.serve({ port: 0, fetch(req) {...} })`, where the handler takes a
// web `Request` and returns a web `Response` (including streaming
// ReadableStream bodies). Node has no built-in equivalent, so this adapts a
// Node http.Server to that same fetch-style contract and exposes a
// `{ port, stop() }` handle compatible with how the tests use it.

export type FetchHandler = (req: Request) => Response | Promise<Response>;

export interface MockServer {
  port: number;
  stop(closeActiveConnections?: boolean): void;
}

export function serve(handler: FetchHandler): MockServer {
  // Bun.serve({ port: 0 }) hands back the OS-assigned port *synchronously*.
  // Node's `listen(0)` binds on a later tick, so `server.address()` is null if
  // read immediately — which is how the tests use it (`const port = serve(...)`
  // then `http://127.0.0.1:${port}`). To preserve that synchronous contract we
  // pick a random high port ourselves and bind to it. The bind still completes
  // asynchronously, but always before the first request (tests `await` an async
  // generate/fetch before hitting the server).
  const port = 20000 + Math.floor(Math.random() * 40000);

  const server: HttpServer = createServer(async (nodeReq, nodeRes) => {
    // Build a web Request from the incoming node request.
    const chunks: Buffer[] = [];
    for await (const chunk of nodeReq) chunks.push(chunk as Buffer);
    const bodyBuf = Buffer.concat(chunks);

    const url = `http://127.0.0.1:${port}${nodeReq.url ?? '/'}`;

    const headers = new Headers();
    for (const [k, v] of Object.entries(nodeReq.headers)) {
      if (Array.isArray(v)) v.forEach((vv) => headers.append(k, vv));
      else if (v != null) headers.set(k, v);
    }

    const hasBody = nodeReq.method !== 'GET' && nodeReq.method !== 'HEAD';
    const request = new Request(url, {
      method: nodeReq.method,
      headers,
      body: hasBody && bodyBuf.length ? bodyBuf : undefined,
    });

    let response: Response;
    try {
      response = await handler(request);
    } catch (err) {
      nodeRes.statusCode = 500;
      nodeRes.end(String(err));
      return;
    }

    nodeRes.statusCode = response.status;
    response.headers.forEach((value, key) => nodeRes.setHeader(key, value));

    if (response.body) {
      // Stream web ReadableStream → node response (preserves SSE framing).
      Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]).pipe(nodeRes);
    } else {
      const buf = Buffer.from(await response.arrayBuffer());
      nodeRes.end(buf);
    }
  });

  server.listen(port, '127.0.0.1');

  return {

    port,
    stop() {
      server.close();
    },
  };
}
