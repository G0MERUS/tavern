import type { TavernCardV2, TavernCardV2Data } from '../types.ts';
import { AppError } from '../types.ts';

// V1 → V2 → V3 normalization. We store V2 internally; convert at the
// boundaries. V1 is a flat object with six fields. V3 is a superset of V2.

const V1_FIELDS = ['name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example'] as const;

/** True if `raw` looks like a V1 card: flat shape, no spec, all six fields. */
function isV1(raw: unknown): raw is Record<string, string> {
  if (!raw || typeof raw !== 'object') return false;
  if ('spec' in raw) return false;
  return V1_FIELDS.every((f) => f in raw);
}

/** True if `raw` has the V2/V3 envelope. */
function hasSpec(raw: unknown): raw is { spec: string; spec_version?: string; data?: unknown } {
  return !!raw && typeof raw === 'object' && 'spec' in raw;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Build a fully-defaulted V2 data block from any partial input. */
function fillData(d: Record<string, unknown>): TavernCardV2Data {
  const out: TavernCardV2Data = {
    name: str(d['name']),
    description: str(d['description']),
    personality: str(d['personality']),
    scenario: str(d['scenario']),
    first_mes: str(d['first_mes']),
    mes_example: str(d['mes_example']),
    creator_notes: str(d['creator_notes']),
    system_prompt: str(d['system_prompt']),
    post_history_instructions: str(d['post_history_instructions']),
    alternate_greetings: arr(d['alternate_greetings']),
    tags: arr(d['tags']),
    creator: str(d['creator']),
    character_version: str(d['character_version']),
    extensions: obj(d['extensions']),
  };
  // character_book is optional and gets extracted to its own table on import,
  // so pass it through as-is.
  if (d['character_book'] && typeof d['character_book'] === 'object') {
    out.character_book = d['character_book'] as TavernCardV2Data['character_book'];
  }
  return out;
}

/**
 * Normalize whatever was in the PNG/JSON to a strict V2 card.
 * Throws AppError('INVALID_CARD') on garbage.
 */
export function toV2(raw: unknown): TavernCardV2 {
  // V1: flat → wrap.
  if (isV1(raw)) {
    return {
      spec: 'chara_card_v2',
      spec_version: '2.0',
      data: fillData(raw),
    };
  }

  // V2/V3: has spec envelope.
  if (hasSpec(raw)) {
    if (!raw.data || typeof raw.data !== 'object') {
      throw new AppError('INVALID_CARD', 'Card has spec but no data object', 400);
    }

    const data = { ...(raw.data as Record<string, unknown>) };

    // V3 → V2: strip the additions we don't model. `extensions` is open-ended
    // by spec so it survives untouched — unknown proprietary fields live
    // there and round-trips need to be lossless on them.
    if (raw.spec === 'chara_card_v3') {
      delete data['assets'];
      delete data['group_only_greetings'];
      delete data['creation_date'];
      delete data['modification_date'];
      // V3 character_book entries may carry use_regex; the entry extractor in
      // lorebooks.ts doesn't read it, so it falls away naturally.
    }

    const filled = fillData(data);
    if (!filled.name) {
      throw new AppError('INVALID_CARD', 'Card data.name is required', 400, {
        field: 'data.name',
      });
    }

    return { spec: 'chara_card_v2', spec_version: '2.0', data: filled };
  }

  throw new AppError(
    'INVALID_CARD',
    'Unrecognized card format — not V1, V2, or V3',
    400,
  );
}

/**
 * Build a V2 card from scratch (UI character creation).
 * Only `name` strictly required; everything else defaults.
 */
export function emptyV2(partial: Partial<TavernCardV2Data>): TavernCardV2 {
  const data = fillData(partial as Record<string, unknown>);
  if (!data.name) {
    throw new AppError('INVALID_CARD', 'name is required', 400);
  }
  return { spec: 'chara_card_v2', spec_version: '2.0', data };
}
