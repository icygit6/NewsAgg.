BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_background smallint NOT NULL DEFAULT 0
  CHECK (profile_background BETWEEN 0 AND 5);
COMMIT;
