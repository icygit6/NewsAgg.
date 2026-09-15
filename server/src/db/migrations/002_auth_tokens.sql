-- 002_auth_tokens.sql — password reset + email verification.
-- Adds users.email_verified and a single-use, HASHED-token table that backs
-- both the "forgot password" and "verify email" flows. Idempotent — safe to
-- run more than once. Apply with: node scripts/migrate.mjs 002_auth_tokens.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;

-- Google sign-ins arrive with a Google-verified email — don't nag them, and
-- treat pre-existing accounts as verified so this migration never locks anyone
-- out (verification is soft-gated anyway).
UPDATE users SET email_verified = true WHERE email_verified = false;

CREATE TABLE IF NOT EXISTS auth_tokens (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- sha256 hex of the raw token. The raw token lives only in the email link,
  -- never in the database, so a DB leak cannot be replayed against /auth.
  token_hash TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('reset', 'verify')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_hash ON auth_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens (user_id, kind);
