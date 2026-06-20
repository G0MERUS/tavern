import { describe, test, expect } from 'vitest';

import { parseChubUrl } from '../../src/chub/index.ts';

// URL parsing only — fetch tests would hit the live API. The parser is the
// part with edge cases (multiple host aliases, optional scheme, bare slug).

describe('chub URL parsing', () => {
  test.each([
    ['https://chub.ai/characters/anon/cool-bot', 'character', 'anon', 'cool-bot'],
    ['https://www.chub.ai/characters/anon/cool-bot', 'character', 'anon', 'cool-bot'],
    ['https://characterhub.org/characters/anon/cool-bot', 'character', 'anon', 'cool-bot'],
    ['https://www.characterhub.org/characters/anon/cool-bot', 'character', 'anon', 'cool-bot'],
    ['chub.ai/characters/anon/cool-bot', 'character', 'anon', 'cool-bot'],
    ['anon/cool-bot', 'character', 'anon', 'cool-bot'],
    ['  https://chub.ai/characters/anon/cool-bot  ', 'character', 'anon', 'cool-bot'],
    ['https://chub.ai/characters/anon/cool-bot/', 'character', 'anon', 'cool-bot'],
  ])('character: %s', (url, kind, creator, slug) => {
    expect(parseChubUrl(url)).toEqual({ kind, creator, slug } as any);
  });

  test.each([
    ['https://chub.ai/lorebooks/anon/world', 'lorebook', 'anon', 'world'],
    ['chub.ai/lorebooks/anon/world', 'lorebook', 'anon', 'world'],
    ['characterhub.org/lorebooks/anon/world', 'lorebook', 'anon', 'world'],
  ])('lorebook: %s', (url, kind, creator, slug) => {
    expect(parseChubUrl(url)).toEqual({ kind, creator, slug } as any);
  });

  test.each([
    [''],
    ['just-a-slug'],
    ['https://example.com/foo/bar'],
    ['https://chub.ai/'],
    ['https://chub.ai/characters/'],         // missing creator + slug
    ['https://chub.ai/characters/anon'],     // missing slug
  ])('rejects: %s', (url) => {
    expect(parseChubUrl(url)).toBeNull();
  });
});
