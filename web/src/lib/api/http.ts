// ─────────────────────────────────────────────────────────────────────────────
// HTTP shim. The backend speaks plain REST + JSON. ApiError carries the
// backend's stable error code so callers can branch on NOT_FOUND vs VALIDATION
// without string-matching messages.
// ─────────────────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function unwrap<T>(res: Response): Promise<T> {
  if (res.ok) return res.json() as Promise<T>;
  // Backend envelope: { error: { code, message } }
  let code = 'HTTP_ERROR';
  let message = res.statusText;
  try {
    const body = await res.json();
    if (body?.error) {
      code = body.error.code ?? code;
      message = body.error.message ?? message;
    }
  } catch { /* not JSON */ }
  throw new ApiError(res.status, code, message);
}

const json = (body: unknown): RequestInit => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const http = {
  get: <T>(url: string) => fetch(url).then(unwrap<T>),

  post: <T>(url: string, body?: unknown) =>
    fetch(url, { method: 'POST', ...(body !== undefined && json(body)) }).then(unwrap<T>),

  patch: <T>(url: string, body: unknown) =>
    fetch(url, { method: 'PATCH', ...json(body) }).then(unwrap<T>),

  put: <T>(url: string, body: unknown) =>
    fetch(url, { method: 'PUT', ...json(body) }).then(unwrap<T>),

  delete: <T>(url: string) =>
    fetch(url, { method: 'DELETE' }).then(unwrap<T>),

  /** Multipart. Don't set Content-Type — browser adds the boundary. */
  postForm: <T>(url: string, form: FormData) =>
    fetch(url, { method: 'POST', body: form }).then(unwrap<T>),

  patchForm: <T>(url: string, form: FormData) =>
    fetch(url, { method: 'PATCH', body: form }).then(unwrap<T>),
};
