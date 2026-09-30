-- Non-destructive indexes for exact content / same-source headline dedup.
CREATE INDEX IF NOT EXISTS idx_articles_feed_hash ON articles(content_hash) WHERE feed_eligible = true;
CREATE INDEX IF NOT EXISTS idx_articles_feed_headline ON articles(source_id, lower(regexp_replace(btrim(title), '\s+', ' ', 'g'))) WHERE feed_eligible = true;
