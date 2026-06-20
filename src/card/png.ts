// PNG chunk encoder. Inlined from png-chunks-encode (~50 LOC, MIT) so we
// don't pull a separate package for it. CRC-32 comes from `crc-32` — already
// in the tree as a transitive dep of png-chunks-extract.
//
// A hand-rolled CRC table was tried first; Bun 1.3.x miscompiles the
// 8-iteration shift-XOR loop and produces wrong table values. The crc-32
// package precomputes its table at module load via a different code path and
// works. Sanity check when revisiting:
//   bun -e "console.log(((1>>>1)^0xedb88320).toString(16))"  // → edb88320

// @ts-expect-error — crc-32 ships no types; API is trivial: buf(Uint8Array) → number
import { buf as crc32 } from 'crc-32';

export interface Chunk {
  name: string;
  data: Uint8Array;
}

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Encode a chunk array back into a PNG buffer. */
export function encodeChunks(chunks: Chunk[]): Uint8Array {
  // Each chunk: 4 (length) + 4 (type) + data.length + 4 (crc)
  let total = PNG_SIGNATURE.length;
  for (const c of chunks) total += 12 + c.data.length;

  const out = new Uint8Array(total);
  out.set(PNG_SIGNATURE, 0);
  let idx = PNG_SIGNATURE.length;

  // Reuse a 4-byte view for big-endian uint32 writes.
  const u8 = new Uint8Array(4);
  const view = new DataView(u8.buffer);

  for (const { name, data } of chunks) {
    // Length (big-endian).
    view.setUint32(0, data.length, false);
    out.set(u8, idx);
    idx += 4;

    // Type (4 ASCII bytes).
    out[idx++] = name.charCodeAt(0);
    out[idx++] = name.charCodeAt(1);
    out[idx++] = name.charCodeAt(2);
    out[idx++] = name.charCodeAt(3);

    // Data.
    out.set(data, idx);
    idx += data.length;

    // CRC over type+data (PNG spec §5.3). crc-32 takes a single buffer, so
    // build the concatenation. Costs a copy per chunk; PNGs are small.
    const payload = new Uint8Array(4 + data.length);
    payload[0] = name.charCodeAt(0);
    payload[1] = name.charCodeAt(1);
    payload[2] = name.charCodeAt(2);
    payload[3] = name.charCodeAt(3);
    payload.set(data, 4);

    // crc-32 returns signed int32; setInt32 writes the same bit pattern.
    view.setInt32(0, crc32(payload), false);
    out.set(u8, idx);
    idx += 4;
  }

  return out;
}
