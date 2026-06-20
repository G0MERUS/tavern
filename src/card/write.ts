import extract from 'png-chunks-extract';
import * as PNGtext from 'png-chunk-text';
import { encodeChunks, type Chunk } from './png.ts';
import type { TavernCardV2 } from '../types.ts';

// Embed character data into a PNG. Writes BOTH `chara` (V2) and `ccv3` (V3)
// chunks so the export is readable by V2-only and V3-only tools alike.
// Strips any existing chara/ccv3 chunks first; leaves other tEXt alone.

const CARD_KEYWORDS = new Set(['chara', 'ccv3']);

export function writeCard(image: Uint8Array, data: TavernCardV2): Uint8Array {
  const chunks: Chunk[] = extract(image);

  // Drop existing card chunks. Don't touch unrelated tEXt — some tools store
  // extra metadata there and we want lossless round-trips.
  const kept = chunks.filter((chunk) => {
    if (chunk.name !== 'tEXt') return true;
    const decoded = PNGtext.decode(chunk.data);
    return !CARD_KEYWORDS.has(decoded.keyword.toLowerCase());
  });

  // Find IEND — new chunks go right before it.
  const iend = kept.findIndex((c) => c.name === 'IEND');
  const insertAt = iend >= 0 ? iend : kept.length;

  const newChunks: Chunk[] = [];

  // V2 `chara` chunk — the universally-supported one.
  const json = JSON.stringify(data);
  const b64 = Buffer.from(json, 'utf8').toString('base64');
  newChunks.push(PNGtext.encode('chara', b64));

  // V3 `ccv3` chunk — best-effort. V2-only is fine if the spec-field rewrite
  // blows up for whatever reason.
  try {
    const v3 = { ...data, spec: 'chara_card_v3', spec_version: '3.0' };
    const v3b64 = Buffer.from(JSON.stringify(v3), 'utf8').toString('base64');
    newChunks.push(PNGtext.encode('ccv3', v3b64));
  } catch {
    // Fall through with only the V2 chunk.
  }

  kept.splice(insertAt, 0, ...newChunks);
  return encodeChunks(kept);
}
