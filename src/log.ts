// ───────────────────────────────────────────────────────────────────────────
// Central logger. Everything the server does is printed to stdout/stderr so it
// shows up in the Termux console. No log files, no levels to configure — on a
// single-user phone app you want to SEE what happened, especially around the
// upstream proxy and message generation.
//
// Set TAVERN_LOG=quiet to silence the per-request HTTP noise (errors and the
// LLM/proxy traffic are always printed). Set TAVERN_LOG=trace to also dump full
// request/response bodies (can be large).
// ───────────────────────────────────────────────────────────────────────────

const MODE = (process.env['TAVERN_LOG'] ?? 'verbose').toLowerCase();
export const LOG_QUIET = MODE === 'quiet';
export const LOG_TRACE = MODE === 'trace';

// ANSI colours. Termux renders these fine. We keep it tasteful: a coloured tag
// per subsystem so you can eyeball the stream.
const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[1;31m',
  green: '\x1b[1;32m',
  yellow: '\x1b[1;33m',
  blue: '\x1b[1;34m',
  magenta: '\x1b[1;35m',
  cyan: '\x1b[1;36m',
  gray: '\x1b[90m',
};

function stamp(): string {
  // HH:MM:SS.mmm — enough to correlate events, no date clutter.
  const d = new Date();
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

function line(colour: string, tag: string, msg: string): string {
  return `${C.gray}${stamp()}${C.reset} ${colour}${tag.padEnd(7)}${C.reset} ${msg}`;
}

/** Truncate long strings for log readability (unless TAVERN_LOG=trace). */
export function preview(value: unknown, max = 800): string {
  let s: string;
  try {
    s = typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    s = String(value);
  }
  if (s == null) return String(value);
  if (LOG_TRACE || s.length <= max) return s;
  return s.slice(0, max) + `${C.dim}…(+${s.length - max} chars)${C.reset}`;
}

export const log = {
  /** General server lifecycle / info. */
  info(msg: string, ...extra: unknown[]): void {
    console.log(line(C.cyan, 'info', msg), ...extra);
  },
  /** Successful / positive events. */
  ok(msg: string, ...extra: unknown[]): void {
    console.log(line(C.green, 'ok', msg), ...extra);
  },
  warn(msg: string, ...extra: unknown[]): void {
    console.warn(line(C.yellow, 'warn', msg), ...extra);
  },
  error(msg: string, ...extra: unknown[]): void {
    console.error(line(C.red, 'error', msg), ...extra);
  },
  /** Incoming HTTP requests/responses. Silenced by TAVERN_LOG=quiet. */
  http(msg: string, ...extra: unknown[]): void {
    if (LOG_QUIET) return;
    console.log(line(C.blue, 'http', msg), ...extra);
  },
  /** Outbound proxy + upstream LLM traffic. Always printed — this is the
   *  stuff the user most wants to see. */
  llm(msg: string, ...extra: unknown[]): void {
    console.log(line(C.magenta, 'llm', msg), ...extra);
  },
  /** Database / blob / misc subsystem chatter. Silenced by quiet. */
  debug(msg: string, ...extra: unknown[]): void {
    if (LOG_QUIET) return;
    console.log(line(C.gray, 'debug', msg), ...extra);
  },
};

export const colours = C;
