-- Reader corrections: the report's ethics section calls for a route to flag
-- wrong sentiment, topics, summaries, translations or extracted text. Reports
-- are reviewed by the team; nothing here changes an article automatically.
-- article_id has no foreign key so a report outlives a later cleanup of its
-- article, which keeps the correction history intact.
CREATE TABLE IF NOT EXISTS article_reports (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  article_id TEXT NOT NULL CHECK (article_id ~ '^[0-9a-f]{16}$'),
  reason TEXT NOT NULL CHECK (reason IN ('sentiment', 'topic', 'summary', 'translation', 'content', 'other')),
  message TEXT NOT NULL DEFAULT '' CHECK (char_length(message) <= 1000),
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_article_reports_status_created
  ON article_reports (status, created_at DESC);
