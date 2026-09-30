-- Account-level locale and registration consent. The terms timestamp is an
-- audit record; email updates remain optional and can be changed later.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS preferred_language TEXT NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS email_updates BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_preferred_language_check;
ALTER TABLE users
  ADD CONSTRAINT users_preferred_language_check
  CHECK (preferred_language IN ('en', 'zhTW'));
