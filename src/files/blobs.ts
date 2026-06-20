import { mkdirSync, existsSync, unlinkSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { nanoid } from 'nanoid';
import sanitize from 'sanitize-filename';
import { getConfig } from '../config.ts';
import { AppError } from '../types.ts';

// Blob storage. SQLite stores text; the filesystem stores images and
// uploads. Filenames are <nanoid>.<ext>. Cascade-delete on the DB row drops
// the blob — no refcounting, no GC daemon.

export type BlobKind = 'avatars' | 'backgrounds' | 'attachments';

const KINDS: BlobKind[] = ['avatars', 'backgrounds', 'attachments'];

// The actual risk on a localhost app is XSS via uploaded HTML served from
// the same origin.
const UNSAFE_EXTENSIONS = new Set([
  '.php', '.exe', '.com', '.dll', '.pif', '.application', '.gadget', '.msi',
  '.jar', '.cmd', '.bat', '.reg', '.sh', '.py', '.js', '.jse', '.jsp',
  '.html', '.htm', '.hta', '.vb', '.vbs', '.vbe', '.cpl', '.msc', '.scr',
  '.ps1', '.ps1xml', '.psc1', '.psc2', '.msh', '.mshxml', '.scf', '.lnk',
  '.inf', '.svg', '.xml',
]);

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

let blobsRoot: string;

/** Create blob directories. Idempotent. */
export function initBlobs(): void {
  blobsRoot = join(getConfig().dataDir, 'blobs');
  for (const kind of KINDS) mkdirSync(join(blobsRoot, kind), { recursive: true });
  mkdirSync(join(blobsRoot, '.thumbs', 'avatars'), { recursive: true });
  mkdirSync(join(blobsRoot, '.thumbs', 'backgrounds'), { recursive: true });
}

export function blobDir(kind: BlobKind): string {
  return join(blobsRoot, kind);
}

export function blobPath(kind: BlobKind, filename: string): string {
  // Defensive: sanitize even though we generate the names ourselves. The
  // /thumbnails/:type/:filename route accepts user input.
  const safe = sanitize(filename);
  if (!safe) throw new AppError('INVALID_FILENAME', 'Empty or unsafe filename', 400);
  return join(blobsRoot, kind, safe);
}

export function thumbPath(kind: 'avatars' | 'backgrounds', filename: string): string {
  const safe = sanitize(filename);
  if (!safe) throw new AppError('INVALID_FILENAME', 'Empty or unsafe filename', 400);
  return join(blobsRoot, '.thumbs', kind, safe + '.webp');
}

/**
 * Save bytes to a blob. Returns the generated filename (no path).
 * Backgrounds and avatars validate against the image allowlist; attachments
 * only reject the unsafe-extension list. Avatars are stored as-is (the format
 * is sniffed from magic bytes in avatar.ts), so they may be png/jpg/webp/gif.
 */
export async function saveBlob(
  kind: BlobKind,
  bytes: Uint8Array | ArrayBuffer,
  ext: string,
): Promise<string> {
  const e = ext.startsWith('.') ? ext.toLowerCase() : '.' + ext.toLowerCase();

  if (UNSAFE_EXTENSIONS.has(e)) {
    throw new AppError('UNSAFE_EXTENSION', `File type ${e} is not allowed`, 400);
  }
  if ((kind === 'backgrounds' || kind === 'avatars') && !IMAGE_EXTENSIONS.has(e)) {
    throw new AppError('INVALID_IMAGE', `Images must be png/jpg/webp/gif, got ${e}`, 400);
  }


  const filename = nanoid(10) + e;
  await Bun.write(join(blobsRoot, kind, filename), bytes);
  return filename;
}

/** Delete a blob. Logs but doesn't throw if already gone — DB consistency wins. */
export function deleteBlob(kind: BlobKind, filename: string | null | undefined): void {
  if (!filename) return;
  const path = join(blobsRoot, kind, sanitize(filename));
  try {
    if (existsSync(path)) unlinkSync(path);
    if (kind === 'avatars' || kind === 'backgrounds') {
      const tp = thumbPath(kind, filename);
      if (existsSync(tp)) unlinkSync(tp);
    }
  } catch (err) {
    console.warn(`blob delete failed (${kind}/${filename}):`, (err as Error).message);
  }
}

/** List backgrounds. No table — they have no metadata, so readdir suffices. */
export function listBackgrounds(): string[] {
  try {
    return readdirSync(join(blobsRoot, 'backgrounds')).filter(
      (f) => !f.startsWith('.') && IMAGE_EXTENSIONS.has(extname(f).toLowerCase()),
    );
  } catch {
    return [];
  }
}

/** Build the public URL for a blob, or null if no blob is set. */
export function blobUrl(kind: BlobKind, filename: string | null): string | null {
  return filename ? `/blobs/${kind}/${filename}` : null;
}

export function thumbUrl(kind: 'avatars' | 'backgrounds', filename: string | null): string | null {
  return filename ? `/thumbnails/${kind}/${filename}` : null;
}
