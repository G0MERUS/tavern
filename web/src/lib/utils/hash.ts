/**
 * Mulberry32 — fast, decent-distribution PRNG. Seeded with chat hash so
 * `{{random}}` and `{{pick}}` macros are stable across regenerate/swipe
 * within the same chat turn.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * djb2-ish 32-bit hash. Stable across sessions; used to seed mulberry32 from
 * chat IDs and macro positions.
 */
export function stringHash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h >>> 0;
}
