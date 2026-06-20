/**
 * Token estimate by char-count heuristic. The original ships 15 tokenizers
 * (~1200 LOC + 30 routes); we ship a divide. The truth comes back in
 * `usage.prompt_tokens` after the call — this is for budget previews only.
 *
 * 3.35 chars/token is the GPT-4-era English mean. Off by ±20% for code or
 * non-Latin text. Good enough for a progress bar.
 */
export function estimateTokens(text: string): number {
  return Math.floor(text.length / 3.35);
}
