import type { TavernCardV2 } from '../types.ts';
import { AppError } from '../types.ts';

// Chub.ai is the only URL importer we keep — the overwhelming majority of
// cards come from there.

const USER_AGENT = 'Tavern/0.1';
const TIMEOUT_MS = 15_000;

export interface ChubRef {
  kind: 'character' | 'lorebook';
  creator: string;
  slug: string;
}

/**
 * Parse a Chub URL into its components. Accepts:
 *   https://chub.ai/characters/<creator>/<slug>
 *   https://www.characterhub.org/characters/<creator>/<slug>
 *   chub.ai/characters/<creator>/<slug>      (no scheme)
 *   <creator>/<slug>                          (bare — assumes character)
 *   .../lorebooks/<creator>/<slug>
 */
export function parseChubUrl(input: string): ChubRef | null {
  // Normalize: drop scheme, drop leading/trailing slashes.
  let s = input.trim().replace(/^https?:\/\//, '').replace(/^\/+|\/+$/g, '');

  // Track whether we recognized a Chub host. Bare creator/slug (no host) is
  // allowed; an *unknown* host is rejected so we don't try to fetch
  // example.com/foo/bar from Chub's API.
  const hadHost = /^(www\.)?(chub\.ai|characterhub\.org)\b/.test(s);
  s = s.replace(/^(www\.)?(chub\.ai|characterhub\.org)\/?/, '');
  // Any TLD-looking thing in the first segment after stripping means a
  // foreign host. Bail.
  const parts = s.split('/').filter(Boolean);
  if (!hadHost && parts[0]?.includes('.')) return null;

  // Explicit kind prefix needs creator + slug — 3 parts minimum.
  if (parts[0] === 'characters') {
    if (parts.length < 3) return null;
    return { kind: 'character', creator: parts[1]!, slug: parts[2]! };
  }
  if (parts[0] === 'lorebooks') {
    if (parts.length < 3) return null;
    return { kind: 'lorebook', creator: parts[1]!, slug: parts[2]! };
  }

  // Bare creator/slug (no host, no kind prefix) → assume character. Only
  // valid when there's no host — a Chub host without a kind prefix doesn't
  // map to anything.
  if (!hadHost && parts.length === 2) {
    return { kind: 'character', creator: parts[0]!, slug: parts[1]! };
  }

  return null;
}

/**
 * Fetch a character from Chub. Returns a V2 card plus raw avatar bytes
 * (if any). Chub's field naming is inverted: their `personality` maps to our
 * `description` and vice versa.
 */
export async function fetchChubCharacter(
  ref: ChubRef,
): Promise<{ card: TavernCardV2; avatar: Uint8Array | null }> {
  const url = `https://api.chub.ai/api/characters/${ref.creator}/${ref.slug}?full=true`;
  const meta = await chubGet(url);

  const node = meta?.node;
  const def = node?.definition;
  if (!def || typeof def !== 'object') {
    throw new AppError('CHUB_INVALID', 'Chub response missing node.definition', 502);
  }

  const card: TavernCardV2 = {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: str(def.name),
      description: str(def.personality), // intentional — Chub swaps these
      personality: str(def.tavern_personality),
      scenario: str(def.scenario),
      first_mes: str(def.first_message),
      mes_example: str(def.example_dialogs),
      creator_notes: str(def.description),
      system_prompt: str(def.system_prompt),
      post_history_instructions: str(def.post_history_instructions),
      alternate_greetings: arr(def.alternate_greetings),
      tags: arr(node.topics),
      creator: ref.creator,
      character_version: '',
      character_book: def.embedded_lorebook ?? undefined,
      extensions: typeof def.extensions === 'object' && def.extensions ? def.extensions : {},
    },
  };

  // Avatar fetch is best-effort; fall back to no avatar if it fails.
  let avatar: Uint8Array | null = null;
  const avatarUrl: unknown = node.max_res_url ?? node.avatar_url;
  if (typeof avatarUrl === 'string' && avatarUrl) {
    try {
      const res = await fetch(avatarUrl, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'User-Agent': USER_AGENT },
      });
      if (res.ok) avatar = new Uint8Array(await res.arrayBuffer());
    } catch {
      // No avatar is fine.
    }
  }

  return { card, avatar };
}

/**
 * Fetch a lorebook from Chub. Two-hop: metadata → project ID → raw JSON file.
 * Returns the SillyTavern-format world info JSON directly; the lorebooks
 * importer parses it the same as a file upload.
 */
export async function fetchChubLorebook(ref: ChubRef): Promise<{ name: string; data: unknown }> {
  const metaUrl = `https://api.chub.ai/api/lorebooks/${ref.creator}/${ref.slug}`;
  const meta = await chubGet(metaUrl);

  const projectId = meta?.node?.id;
  if (!projectId) {
    throw new AppError('CHUB_INVALID', 'Project ID not found in lorebook metadata', 502);
  }

  // Note the double-encoded slash in the path (raw%252F → raw/sillytavern_raw.json).
  const dlUrl = `https://api.chub.ai/api/v4/projects/${projectId}/repository/files/raw%252Fsillytavern_raw.json/raw`;
  const data = await chubGet(dlUrl);

  return { name: ref.slug, data };
}

async function chubGet(url: string): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if ((err as Error).name === 'TimeoutError') {
      throw new AppError('CHUB_UNREACHABLE', 'Chub request timed out', 504);
    }
    throw new AppError('CHUB_UNREACHABLE', `Chub fetch failed: ${(err as Error).message}`, 502);
  }

  if (res.status === 404) {
    throw new AppError('CHUB_NOT_FOUND', 'Not found on Chub', 404);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new AppError(
      'CHUB_FETCH_FAILED',
      `Chub returned ${res.status}: ${text.slice(0, 200)}`,
      502,
      { status: res.status },
    );
  }

  return res.json();
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
