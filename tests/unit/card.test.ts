import { describe, test, expect } from 'vitest';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import extract from 'png-chunks-extract';
import * as PNGtext from 'png-chunk-text';

import { makePng, pngMeta } from '../png-util.ts';


import { readCard, NoCardDataError } from '../../src/card/parse.ts';
import { writeCard } from '../../src/card/write.ts';
import { encodeChunks } from '../../src/card/png.ts';
import { toV2, emptyV2 } from '../../src/card/normalize.ts';
import type { TavernCardV2 } from '../../src/types.ts';
import { FIXTURES } from '../setup.ts';

// PNG card I/O is the interop boundary — a malformed export breaks compat
// with every other tool.

const seraphina = readFileSync(join(FIXTURES, 'seraphina.png'));

describe('card/parse', () => {
  test('reads Seraphina (real-world card with both chara + ccv3)', () => {
    const raw = readCard(seraphina);
    expect(raw).toBeTypeOf('object');
    // ccv3 wins over chara.
    expect((raw as any).spec).toBe('chara_card_v3');
    expect((raw as any).data.name).toBe('Seraphina');
    expect((raw as any).data.character_book).toBeTypeOf('object');

    expect((raw as any).data.character_book.entries).toHaveLength(4);
  });

  test('throws NoCardDataError on PNG without tEXt', () => {
    // A clean PNG — no tEXt chunks.
    const blank = makePng(8, 8);

    expect(() => readCard(blank)).toThrow(NoCardDataError);
  });

  test('throws NoCardDataError when tEXt exists but no chara/ccv3 keyword', () => {
    const blank = makePng(8, 8);

    // Inject an unrelated tEXt chunk — readCard should ignore it.
    const chunks = extract(blank);
    chunks.splice(-1, 0, PNGtext.encode('Software', 'test'));

    const tagged = encodeChunks(chunks);

    expect(() => readCard(tagged)).toThrow(NoCardDataError);
  });
});

describe('card/normalize', () => {
  test('upgrades V1 flat shape to V2 envelope', () => {
    const v1 = {
      name: 'Alice',
      description: 'A curious girl',
      personality: 'inquisitive',
      scenario: 'Wonderland',
      first_mes: 'Hello!',
      mes_example: '',
    };

    const v2 = toV2(v1);
    expect(v2.spec).toBe('chara_card_v2');
    expect(v2.spec_version).toBe('2.0');
    expect(v2.data.name).toBe('Alice');
    expect(v2.data.description).toBe('A curious girl');
    // V2 fields backfilled.
    expect(v2.data.alternate_greetings).toEqual([]);
    expect(v2.data.tags).toEqual([]);
    expect(v2.data.extensions).toEqual({});
  });

  test('downgrades V3 → V2: strips assets, keeps extensions', () => {
    const v3 = {
      spec: 'chara_card_v3',
      spec_version: '3.0',
      data: {
        name: 'Bob',
        description: 'd', personality: 'p', scenario: 's',
        first_mes: 'f', mes_example: 'm',
        assets: [{ type: 'icon', uri: 'embedded' }],   // V3-only, stripped
        group_only_greetings: ['hi group'],            // V3-only, stripped
        creation_date: 1700000000,                     // V3-only, stripped
        extensions: { my_proprietary_field: { x: 1 } }, // open-ended, kept
      },
    };

    const v2 = toV2(v3);
    expect(v2.spec).toBe('chara_card_v2');
    expect((v2.data as any).assets).toBeUndefined();
    expect((v2.data as any).group_only_greetings).toBeUndefined();
    expect((v2.data as any).creation_date).toBeUndefined();
    // Lossless roundtrip on unknown fields is the whole point.
    expect(v2.data.extensions).toEqual({ my_proprietary_field: { x: 1 } });
  });

  test('Seraphina V3 → V2 normalization preserves embedded book', () => {
    const raw = readCard(seraphina);
    const v2 = toV2(raw);

    expect(v2.spec).toBe('chara_card_v2');
    expect(v2.data.name).toBe('Seraphina');
    expect(v2.data.character_book).toBeDefined();
    expect(v2.data.character_book!.entries).toHaveLength(4);

    // Spot-check a book entry survived intact
    const entry = v2.data.character_book!.entries[0]!;
    expect(entry.keys.length).toBeGreaterThan(0);
    expect(entry.content.length).toBeGreaterThan(0);
  });

  test('rejects garbage', () => {
    expect(() => toV2(null)).toThrow();
    expect(() => toV2('string')).toThrow();
    expect(() => toV2({ spec: 'chara_card_v2' })).toThrow();
    expect(() => toV2({ spec: 'chara_card_v2', data: { name: '' } })).toThrow();
  });

  test('emptyV2 builds card from scratch with defaults', () => {
    const card = emptyV2({ name: 'Test', description: 'desc' });
    expect(card.data.name).toBe('Test');
    expect(card.data.description).toBe('desc');
    expect(card.data.scenario).toBe('');
    expect(card.data.alternate_greetings).toEqual([]);
  });
});

describe('card/write — full roundtrip', () => {
  test('write → read recovers identical data', () => {
    const blank = makePng(16, 16, [0xaa, 0xbb, 0xcc]);

    const card: TavernCardV2 = emptyV2({

      name: 'Roundtrip',
      description: 'Test character with "quotes" and unicode: 日本語 émoji 🎭',
      tags: ['test', 'unicode'],
    });

    const embedded = writeCard(blank, card);
    const recovered = readCard(embedded);

    // ccv3 wins on read, so spec is rewritten — but data is identical.
    expect((recovered as any).data).toEqual(card.data);
  });

  test('writes both chara AND ccv3 chunks', () => {
    const blank = makePng(8, 8);

    const out = writeCard(blank, emptyV2({ name: 'Dual' }));

    const chunks = extract(out);
    const keywords = chunks
      .filter((c) => c.name === 'tEXt')
      .map((c) => PNGtext.decode(c.data).keyword);

    expect(keywords).toContain('chara');
    expect(keywords).toContain('ccv3');
  });

  test('strips existing chara/ccv3, leaves unrelated tEXt alone', () => {
    const blank = makePng(8, 8);

    const chunks = extract(blank);

    chunks.splice(-1, 0, PNGtext.encode('Author', 'Somebody'));
    const tagged = encodeChunks(chunks);

    // Embed a card twice — second write should replace first, not append.
    const once = writeCard(tagged, emptyV2({ name: 'V1' }));
    const twice = writeCard(once, emptyV2({ name: 'V2' }));

    const final = extract(twice).filter((c) => c.name === 'tEXt');
    const decoded = final.map((c) => PNGtext.decode(c.data));

    // Expect: chara (1), ccv3 (1), Author (1), ONLY V2 data.
    expect(decoded.filter((d) => d.keyword === 'chara')).toHaveLength(1);
    expect(decoded.filter((d) => d.keyword === 'ccv3')).toHaveLength(1);
    expect(decoded.filter((d) => d.keyword === 'Author')).toHaveLength(1);

    expect((readCard(twice) as any).data.name).toBe('V2');
  });

  test('output is a valid PNG (IHDR survives the tEXt embed)', () => {
    const blank = makePng(32, 48, [0xff, 0x00, 0xff]);

    const out = writeCard(blank, emptyV2({ name: 'Valid' }));
    const meta = pngMeta(out);

    // If our CRC-32 or chunk encoding corrupted the structure, the IHDR
    // dimensions wouldn't read back cleanly past the inserted tEXt chunks.
    expect(meta.format).toBe('png');
    expect(meta.width).toBe(32);
    expect(meta.height).toBe(48);
  });

  test('Seraphina full roundtrip: read → normalize → write → read', () => {
    const raw = readCard(seraphina);
    const v2 = toV2(raw);

    // Re-embed into a fresh image (simulating: blob from disk + data from DB)
    const blank = makePng(512, 768);

    const reexported = writeCard(blank, v2);

    const recovered = toV2(readCard(reexported));

    expect(recovered.data.name).toBe('Seraphina');
    expect(recovered.data.description).toBe(v2.data.description);
    expect(recovered.data.first_mes).toBe(v2.data.first_mes);
    expect(recovered.data.character_book?.entries).toHaveLength(4);
    expect(recovered.data).toEqual(v2.data);
  });
});
