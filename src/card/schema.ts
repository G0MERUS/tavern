import { t } from '../_compat/elysia.ts';


// TypeBox schemas for request validation. Elysia validates these at runtime
// and exports the inferred types via Eden Treaty for the frontend client.

export const CharacterBookEntrySchema = t.Object({
  keys: t.Array(t.String()),
  content: t.String(),
  extensions: t.Record(t.String(), t.Unknown(), { default: {} }),
  enabled: t.Boolean({ default: true }),
  insertion_order: t.Number({ default: 100 }),
  case_sensitive: t.Optional(t.Boolean()),
  name: t.Optional(t.String()),
  priority: t.Optional(t.Number()),
  id: t.Optional(t.Number()),
  comment: t.Optional(t.String()),
  selective: t.Optional(t.Boolean()),
  secondary_keys: t.Optional(t.Array(t.String())),
  constant: t.Optional(t.Boolean()),
  position: t.Optional(t.Union([t.Literal('before_char'), t.Literal('after_char')])),
});

export const CharacterBookSchema = t.Object({
  name: t.Optional(t.String()),
  description: t.Optional(t.String()),
  scan_depth: t.Optional(t.Number()),
  token_budget: t.Optional(t.Number()),
  recursive_scanning: t.Optional(t.Boolean()),
  extensions: t.Record(t.String(), t.Unknown(), { default: {} }),
  entries: t.Array(CharacterBookEntrySchema),
});

/**
 * V2 card data block. Used for POST /api/characters validation when the user
 * is creating from scratch (vs importing). Lenient — only `name` required;
 * normalize.ts fills the rest.
 */
export const V2DataPartialSchema = t.Object({
  name: t.String({ minLength: 1 }),
  description: t.Optional(t.String()),
  personality: t.Optional(t.String()),
  scenario: t.Optional(t.String()),
  first_mes: t.Optional(t.String()),
  mes_example: t.Optional(t.String()),
  creator_notes: t.Optional(t.String()),
  system_prompt: t.Optional(t.String()),
  post_history_instructions: t.Optional(t.String()),
  alternate_greetings: t.Optional(t.Array(t.String())),
  tags: t.Optional(t.Array(t.String())),
  creator: t.Optional(t.String()),
  character_version: t.Optional(t.String()),
  extensions: t.Optional(t.Record(t.String(), t.Unknown())),
});

/** Crop rectangle for avatar uploads. */
export const CropSchema = t.Object({
  x: t.Number({ minimum: 0 }),
  y: t.Number({ minimum: 0 }),
  width: t.Number({ minimum: 1 }),
  height: t.Number({ minimum: 1 }),
});
