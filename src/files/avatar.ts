import { saveBlob } from './blobs.ts';

// Avatar handling. We store the uploaded image as-is (no server-side crop or
// resize) so the backend has zero native image dependencies — this keeps it
// installable on platforms like Termux where libvips/sharp won't build.
//
// Card data lives in the database; the PNG-with-tEXt is reconstructed on
// export from the stored image bytes.

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Sniff the image format from magic bytes. Falls back to .png. */
function detectExt(buf: Uint8Array): string {
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return '.png';
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return '.jpg';
  // GIF: "GIF8"
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return '.gif';
  // WEBP: "RIFF"...."WEBP"
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return '.webp';
  }
  return '.png';
}

/**
 * Save an avatar image as-is. The `crop` argument is accepted for API
 * compatibility but ignored — cropping/resizing now happens client-side (or
 * not at all). Returns the saved blob filename.
 */
export async function normalizeAvatar(
  input: Uint8Array | ArrayBuffer,
  _crop?: CropRect,
): Promise<string> {
  const buf = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
  return saveBlob('avatars', buf, detectExt(buf));
}
