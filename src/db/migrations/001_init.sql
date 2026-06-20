-- characters: one row per imported/created character. `data` holds the full V2
-- card JSON verbatim — we're an interchange node, not the schema owner.
CREATE TABLE characters (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  data          TEXT NOT NULL,                      -- full V2 card JSON; character_book extracted to lorebooks
  avatar_blob   TEXT,                               -- filename in blobs/avatars/, image only, no tEXt
  fav           INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  last_chat_at  INTEGER,                            -- denorm: bumped on message insert for "recently used" sort
  -- Generated columns for cheap filtering without json_extract on every WHERE.
  name_search   TEXT GENERATED ALWAYS AS (lower(json_extract(data, '$.data.name'))) VIRTUAL,
  creator       TEXT GENERATED ALWAYS AS (json_extract(data, '$.data.creator')) VIRTUAL
);
CREATE INDEX idx_characters_sort ON characters(fav DESC, last_chat_at DESC);
CREATE INDEX idx_characters_name ON characters(name COLLATE NOCASE);

-- personas: user identities.
CREATE TABLE personas (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',           -- substituted into {{persona}} macro
  avatar_blob   TEXT,
  is_default    INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

-- groups + group_members.
CREATE TABLE groups (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  avatar_blob          TEXT,
  activation_strategy  INTEGER NOT NULL DEFAULT 0,  -- 0=natural, 1=list-order, 2=manual
  generation_mode      INTEGER NOT NULL DEFAULT 0,  -- 0=swap-system, 1=append-all
  allow_self_response  INTEGER NOT NULL DEFAULT 0,
  auto_mode_delay      INTEGER NOT NULL DEFAULT 5,
  metadata             TEXT NOT NULL DEFAULT '{}',  -- JSON: niche knobs (join_prefix etc)
  fav                  INTEGER NOT NULL DEFAULT 0,
  created_at           INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at           INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE group_members (
  group_id      TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  character_id  TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  position      INTEGER NOT NULL,
  enabled       INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (group_id, character_id)
);
CREATE INDEX idx_group_members_pos ON group_members(group_id, position);

-- chats: solo XOR group. The CHECK constraint enforces exactly one parent.
CREATE TABLE chats (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  character_id  TEXT REFERENCES characters(id) ON DELETE CASCADE,
  group_id      TEXT REFERENCES groups(id) ON DELETE CASCADE,
  persona_id    TEXT REFERENCES personas(id) ON DELETE SET NULL,
  metadata      TEXT NOT NULL DEFAULT '{}',         -- JSON: scenario_override, note_prompt, note_depth, etc
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK ((character_id IS NULL) <> (group_id IS NULL))
);
CREATE INDEX idx_chats_character ON chats(character_id, updated_at DESC);
CREATE INDEX idx_chats_group     ON chats(group_id, updated_at DESC);
CREATE INDEX idx_chats_recent    ON chats(updated_at DESC);

-- messages: position is a sparse integer (gap of 1024) so mid-chat inserts
-- don't reorder neighbours until gaps run out.
CREATE TABLE messages (
  id            TEXT PRIMARY KEY,
  chat_id       TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  position      INTEGER NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  character_id  TEXT REFERENCES characters(id) ON DELETE SET NULL,  -- speaker (group chats); NULL for user/system
  content       TEXT NOT NULL,                      -- the active swipe text
  swipes        TEXT NOT NULL DEFAULT '[]',         -- JSON: [{content, model?, gen_at?}, ...]
  swipe_idx     INTEGER NOT NULL DEFAULT 0,
  extra         TEXT NOT NULL DEFAULT '{}',         -- JSON: model, token_count, finish_reason, attachments[], reasoning?
  is_hidden     INTEGER NOT NULL DEFAULT 0,         -- excluded from prompt context but visible in UI
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX idx_messages_chat_pos ON messages(chat_id, position);
CREATE INDEX        idx_messages_chat_ts  ON messages(chat_id, created_at DESC);

-- FTS5 sidecar for full-text search across all messages.
CREATE VIRTUAL TABLE messages_fts USING fts5(
  content,
  content='messages',
  content_rowid='rowid',
  tokenize='unicode61'
);
CREATE TRIGGER messages_fts_insert AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
END;
CREATE TRIGGER messages_fts_delete AFTER DELETE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
END;
CREATE TRIGGER messages_fts_update AFTER UPDATE OF content ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
  INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
END;

-- lorebooks: World Info. Embedded character_books are extracted here on
-- import with source='character:<id>' and re-embedded on export.
CREATE TABLE lorebooks (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  scan_depth    INTEGER NOT NULL DEFAULT 4,
  token_budget  INTEGER NOT NULL DEFAULT 500,
  recursive     INTEGER NOT NULL DEFAULT 0,
  source        TEXT,                               -- 'standalone' | 'character:<id>'; provenance, doesn't gate usage
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE lorebook_entries (
  id              TEXT PRIMARY KEY,
  lorebook_id     TEXT NOT NULL REFERENCES lorebooks(id) ON DELETE CASCADE,
  keys            TEXT NOT NULL DEFAULT '[]',       -- JSON array; matching is app-side (regex, partial-word, case-fold)
  secondary_keys  TEXT NOT NULL DEFAULT '[]',
  content         TEXT NOT NULL,
  comment         TEXT NOT NULL DEFAULT '',
  enabled         INTEGER NOT NULL DEFAULT 1,
  constant        INTEGER NOT NULL DEFAULT 0,
  selective       INTEGER NOT NULL DEFAULT 0,
  case_sensitive  INTEGER NOT NULL DEFAULT 0,
  position        TEXT NOT NULL DEFAULT 'before_char' CHECK (position IN ('before_char', 'after_char', 'at_depth')),
  depth           INTEGER,
  insertion_order INTEGER NOT NULL DEFAULT 100,
  priority        INTEGER NOT NULL DEFAULT 100,
  extensions      TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_lorebook_entries_scan ON lorebook_entries(lorebook_id, enabled, constant);

CREATE TABLE lorebook_bindings (
  lorebook_id   TEXT NOT NULL REFERENCES lorebooks(id) ON DELETE CASCADE,
  character_id  TEXT REFERENCES characters(id) ON DELETE CASCADE,
  group_id      TEXT REFERENCES groups(id) ON DELETE CASCADE,
  CHECK ((character_id IS NULL) <> (group_id IS NULL))
);
-- SQLite doesn't allow expressions in a PRIMARY KEY clause; enforce
-- uniqueness via two partial indexes instead. Each binding is unique within
-- its kind.
CREATE UNIQUE INDEX idx_lorebook_bindings_char  ON lorebook_bindings(lorebook_id, character_id) WHERE character_id IS NOT NULL;
CREATE UNIQUE INDEX idx_lorebook_bindings_group ON lorebook_bindings(lorebook_id, group_id)     WHERE group_id IS NOT NULL;
CREATE INDEX idx_lorebook_bindings_lookup_char  ON lorebook_bindings(character_id);
CREATE INDEX idx_lorebook_bindings_lookup_group ON lorebook_bindings(group_id);

-- connections: LLM endpoint profiles.
CREATE TABLE connections (
  id            TEXT PRIMARY KEY,
  label         TEXT NOT NULL,
  base_url      TEXT NOT NULL,
  api_key       TEXT NOT NULL DEFAULT '',           -- plaintext; localhost app, sent in plaintext to upstream anyway
  model         TEXT NOT NULL,
  extra_headers TEXT NOT NULL DEFAULT '{}',
  extra_body    TEXT NOT NULL DEFAULT '{}',
  is_active     INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

-- presets: sampling parameters. params is a JSON blob spread into the
-- request body; the upstream validates.
CREATE TABLE presets (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  params        TEXT NOT NULL DEFAULT '{}',
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

-- settings: backend-relevant K/V only. UI state goes to localStorage.
CREATE TABLE settings (
  key           TEXT PRIMARY KEY,
  value         TEXT NOT NULL,
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

-- tags: denormalized index over data.tags for server-side filtering. The
-- JSON data.tags stays the source of truth for export.
CREATE TABLE tags (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  color         TEXT,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE character_tags (
  character_id  TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  tag_id        TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (character_id, tag_id)
);
CREATE INDEX idx_character_tags_tag ON character_tags(tag_id);
