BEGIN;
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS content_blocks JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS quality_metadata JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS summary_method TEXT,
  ADD COLUMN IF NOT EXISTS content_hash TEXT,
  ADD COLUMN IF NOT EXISTS extraction_version TEXT,
  ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS feed_eligible BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_articles_active_published ON articles (published_at DESC, id) WHERE feed_eligible;
CREATE TABLE IF NOT EXISTS article_chunks (
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  content TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  model TEXT NOT NULL,
  embedding vector(1024),
  PRIMARY KEY(article_id, position)
);
CREATE TABLE IF NOT EXISTS scraper_runs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  report JSONB NOT NULL DEFAULT '{}'
);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'General';
CREATE INDEX IF NOT EXISTS idx_posts_category_created ON posts(category,created_at DESC,id DESC) WHERE deleted_at IS NULL;
UPDATE posts p SET category=a.topic FROM articles a WHERE p.article_id=a.id AND p.category='General';
COMMIT;
