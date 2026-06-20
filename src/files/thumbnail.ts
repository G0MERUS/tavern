import { existsSync } from 'node:fs';
import { blobPath } from './blobs.ts';

// Thumbnails are no longer generated server-side: that required `sharp`
// (native libvips), which doesn't build on Termux. We now just serve the
// original image and let the browser scale it via CSS. Kept as a function so
// callers (and the /thumbnails route) don't change.

type ThumbKind = 'avatars' | 'backgrounds';

/**
 * Returns the source image path to serve, or null if it doesn't exist.
 */
export async function getOrGenerate(kind: ThumbKind, filename: string): Promise<string | null> {
  const src = blobPath(kind, filename);
  if (!existsSync(src)) return null;
  return src;
}
