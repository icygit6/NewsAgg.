BEGIN;
-- The reader's own list of bookmark collections, in display order. NULL means
-- they never edited it and get the default presets; the first entry is where
-- new bookmarks go.
ALTER TABLE users ADD COLUMN IF NOT EXISTS bookmark_collections text[];
COMMIT;
