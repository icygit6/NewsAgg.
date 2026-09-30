-- Translations cache for the per-article translate feature (CLAUDE.md Feature #1).
--
-- NOTE: article_id is TEXT, not UUID. The live NeonDB uses the old scraper
-- schema where articles.id is a TEXT hash, so this FK must match that type
-- (CLAUDE.md's schema.sql shows UUID, but the live DB diverges — adapt to it).
--
-- The server creates this table lazily on first translate request
-- (server/src/routes/translate.ts → ensureTable). This file is the canonical
-- DDL for reference and manual provisioning.

CREATE TABLE IF NOT EXISTS translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  lang VARCHAR(10) NOT NULL,          -- en | id | zh-CN | zh-TW
  title TEXT,
  description TEXT,
  content TEXT,
  ai_summary TEXT,
  source_hash VARCHAR(64),
  provider VARCHAR(32),
  model_version VARCHAR(128),
  translated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(article_id, lang)
);

CREATE INDEX IF NOT EXISTS idx_translations_article ON translations(article_id);

-- Feed cards use a separate cache so preview-only translations cannot replace
-- a full article translation with NULL content.
CREATE TABLE IF NOT EXISTS article_preview_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  lang VARCHAR(10) NOT NULL,
  title TEXT,
  description TEXT,
  ai_summary TEXT,
  source_hash VARCHAR(64) NOT NULL,
  provider VARCHAR(32) NOT NULL,
  model_version VARCHAR(128) NOT NULL,
  translated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(article_id, lang)
);

CREATE INDEX IF NOT EXISTS idx_preview_translations_article
  ON article_preview_translations(article_id);
