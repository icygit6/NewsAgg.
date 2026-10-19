// The public feed shows the same 45 days that scraper/cleanup.py keeps, so
// nothing still stored is hidden only by age.
export const PUBLIC_WINDOW_DAYS = 45

// Shared by feed and analytics: scraping time is NOT publication time.
// A newer copy hides an older one when it has the same content hash, or the
// same source and normalised headline within a day. The two duplicate tests
// are separate NOT EXISTS clauses on purpose: combined with OR they forced a
// nested-loop anti join comparing every pair of articles (2,712 rows, 7.3M
// regex comparisons, 7-10 s per uncached feed or stats request). Split, each
// becomes an index or hash anti join (~0.2 s) with the identical result set.
const DUPLICATE_BASE = `duplicate.feed_eligible = true
      AND duplicate.extraction_version = 'structured-v3'
      AND jsonb_array_length(duplicate.content_blocks) > 0
      AND duplicate.published_at >= NOW() - interval '${PUBLIC_WINDOW_DAYS} days'
      AND duplicate.published_at <= NOW() + interval '2 hours'
      AND (COALESCE(duplicate.scraped_at, '-infinity'::timestamptz), duplicate.id)
        > (COALESCE(a.scraped_at, '-infinity'::timestamptz), a.id)`

export const ACTIVE_ARTICLES = `a.feed_eligible = true
  AND a.extraction_version = 'structured-v3'
  AND jsonb_array_length(a.content_blocks) > 0
  AND NULLIF(btrim(a.url_to_image), '') IS NOT NULL
  AND a.published_at >= NOW() - interval '${PUBLIC_WINDOW_DAYS} days'
  AND a.published_at <= NOW() + interval '2 hours'
  AND NOT EXISTS (
    SELECT 1 FROM articles duplicate
    WHERE ${DUPLICATE_BASE}
      AND a.content_hash IS NOT NULL AND a.content_hash <> ''
      AND duplicate.content_hash = a.content_hash
  )
  AND NOT EXISTS (
    SELECT 1 FROM articles duplicate
    WHERE ${DUPLICATE_BASE}
      AND duplicate.source_id = a.source_id
      AND lower(regexp_replace(btrim(duplicate.title), '\\s+', ' ', 'g')) = lower(regexp_replace(btrim(a.title), '\\s+', ' ', 'g'))
      AND abs(extract(epoch FROM duplicate.published_at - a.published_at)) < 86400
  )`
