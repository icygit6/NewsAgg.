// Shared by feed and analytics: scraping time is NOT publication time.
export const ACTIVE_ARTICLES = `a.feed_eligible = true
  AND a.extraction_version = 'structured-v3'
  AND jsonb_array_length(a.content_blocks) > 0
  AND a.published_at >= NOW() - interval '30 days'
  AND a.published_at <= NOW() + interval '2 hours'
  AND NOT EXISTS (
    SELECT 1 FROM articles duplicate
    WHERE duplicate.feed_eligible = true
      AND duplicate.extraction_version = 'structured-v3'
      AND jsonb_array_length(duplicate.content_blocks) > 0
      AND duplicate.published_at >= NOW() - interval '30 days'
      AND duplicate.published_at <= NOW() + interval '2 hours'
      AND (COALESCE(duplicate.scraped_at, '-infinity'::timestamptz), duplicate.id)
        > (COALESCE(a.scraped_at, '-infinity'::timestamptz), a.id)
      AND (
        (a.content_hash IS NOT NULL AND a.content_hash <> '' AND duplicate.content_hash = a.content_hash)
        OR (duplicate.source_id = a.source_id
          AND lower(regexp_replace(btrim(duplicate.title), '\\s+', ' ', 'g')) = lower(regexp_replace(btrim(a.title), '\\s+', ' ', 'g'))
          AND abs(extract(epoch FROM duplicate.published_at - a.published_at)) < 86400)
      )
  )`
