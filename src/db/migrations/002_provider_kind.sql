-- connections.kind — wire-format discriminator.
--   'openai'    → POST {base}/chat/completions, Bearer auth
--   'anthropic' → POST {base}/messages, x-api-key, top-level system
--   'google'    → POST {base}/models/{model}:generateContent, x-goog-api-key
-- Existing rows default to 'openai'. ALTER TABLE ADD COLUMN is O(1) in
-- SQLite — schema rewrite, not row rewrite.
ALTER TABLE connections ADD COLUMN kind TEXT NOT NULL DEFAULT 'openai'
  CHECK (kind IN ('openai', 'anthropic', 'google'));
