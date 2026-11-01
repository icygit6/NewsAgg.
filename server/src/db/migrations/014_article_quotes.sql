-- Fetch every reader quote about an article in cursor order without scanning the feed.
CREATE INDEX IF NOT EXISTS idx_posts_article_feed
  ON posts (article_id, created_at DESC, id DESC)
  WHERE deleted_at IS NULL AND article_id IS NOT NULL;
