import { deflateSync } from 'node:zlib';
import { encodeChunks, type Chunk } from '../src/card/png.ts';

// Minimal PNG generator/reader for tests. The backend dropped its `sharp`
// dependency (no native image processing — see src/files/avatar.ts), but the
// card I/O tests still need a couple of throwaway PNGs to embed tEXt chunks
// into and to assert "this is still a decodable PNG". Rather than reintroduce
// sharp just for the test fixtures, we hand-roll the ~30 lines of PNG needed:
// an IHDR + a single zlib-compressed IDAT of solid-colour pixels + IEND.

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, false);
  return b;
}

/** Build a valid RGB PNG of the given size filled with one colour. */
export function makePng(width: number, height: number, rgb: [number, number, number] = [0, 0, 0]): Buffer {
  // IHDR: width, height, bit depth 8, colour type 2 (truecolour), no
  // compression/filter/interlace.
  const ihdr = new Uint8Array(13);
  ihdr.set(u32(width), 0);
  ihdr.set(u32(height), 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // colour type RGB
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  // Raw image data: each scanline is prefixed with a filter-type byte (0).
  const stride = width * 3;
  const raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (stride + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const p = row + 1 + x * 3;
      raw[p] = rgb[0];
      raw[p + 1] = rgb[1];
      raw[p + 2] = rgb[2];
    }
  }
  const idat = new Uint8Array(deflateSync(raw));

  const chunks: Chunk[] = [
    { name: 'IHDR', data: ihdr },
    { name: 'IDAT', data: idat },
    { name: 'IEND', data: new Uint8Array(0) },
  ];
  return Buffer.from(encodeChunks(chunks));
}

export interface PngMeta {
  format: 'png';
  width: number;
  height: number;
}

/** Read width/height from a PNG's IHDR (validates the signature too). */
export function pngMeta(buf: Uint8Array): PngMeta {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < sig.length; i++) {
    if (buf[i] !== sig[i]) throw new Error('not a PNG');
  }
  // IHDR data starts at: 8 (sig) + 4 (length) + 4 (type) = 16.
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return {
    format: 'png',
    width: view.getUint32(16, false),
    height: view.getUint32(20, false),
  };
}
