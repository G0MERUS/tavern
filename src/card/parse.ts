import extract from 'png-chunks-extract';
import * as PNGtext from 'png-chunk-text';

// Reads the raw card object out of a PNG. Returns whatever JSON was embedded —
// V1, V2, or V3; no normalization here.

export class NoCardDataError extends Error {
  constructor() {
    super('PNG contains no character card data (no chara/ccv3 tEXt chunk)');
    this.name = 'NoCardDataError';
  }
}

/**
 * Extract the embedded character JSON from a PNG buffer.
 * V3 (`ccv3` keyword) wins over V2 (`chara` keyword) if both are present.
 */
export function readCard(buffer: Uint8Array): unknown {
  const chunks = extract(buffer);

  const textChunks = chunks
    .filter((c) => c.name === 'tEXt')
    .map((c) => PNGtext.decode(c.data));

  const ccv3 = textChunks.find((c) => c.keyword.toLowerCase() === 'ccv3');
  if (ccv3) return decode(ccv3.text);

  const chara = textChunks.find((c) => c.keyword.toLowerCase() === 'chara');
  if (chara) return decode(chara.text);

  throw new NoCardDataError();
}

/** base64 → UTF-8 → JSON.parse */
function decode(text: string): unknown {
  const json = Buffer.from(text, 'base64').toString('utf8');
  return JSON.parse(json);
}
