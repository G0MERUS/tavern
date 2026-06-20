import { encode } from 'gpt-tokenizer';

// Ballpark token count. cl100k_base (GPT-4) is wrong by ±5-15% for non-OAI
// models, which is fine for "is my prompt approximately under the context
// limit?". The exact count comes back in `usage` post-call.

export function countTokens(text: string): number {
  return encode(text).length;
}
