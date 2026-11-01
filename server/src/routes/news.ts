import { newsSearch } from '../lib/newsSearch'
import { Router, Request, Response } from 'express'
import { logger } from '../lib/logger'
import { query } from '../db/client'
import { PublicationCache } from '../lib/publicationCache'
import { ACTIVE_ARTICLES } from '../lib/articleQuality'

// Ports server.js GET /api/news-from-db against the live DB.
//
// Two modes:
//  - LEGACY (no new query params): byte-compatible with the retired server.js
//    contract — full `a.*` rows, LIMIT 400. The current client depends on it.
//  - PAGINATED (any of page/pageSize/fields/source/sentiment/q/sort present):
//    additive mode with totalCount, an optional summary column set (no
//    content / big JSONB blobs), and filtering/ranking pushed into SQL.
//
// Every DB read is wrapped in a 5-minute TTL cache: articles only change when
// the scraper runs (~daily), and NeonDB's free tier meters Postgres egress —
// the uncached legacy query alone moves ~5-10 MB per request.
export const newsRouter = Router()

const JOINS = `
      FROM articles a
      LEFT JOIN sources s  ON a.source_id = s.id
      LEFT JOIN authors au ON a.author_id = au.id
`

const SOURCE_AUTHOR_COLS = `
        s.name        AS source_name,
        s.domain      AS source_domain,
        s.country     AS source_country,
        s.language    AS source_language,
        s.logo_url    AS source_logo,
        au.name       AS author_name,
        au.author_url AS author_url
`

// Summary mode drops the heavyweight columns: content plus the large JSONB
// blobs (entities/images/related_urls/og_data/ai_label_scores/meta_tags) and
// the readability scores. `keywords` stays — TrendingKeywords still derives
// from list payloads until dedicated stats endpoints exist.
const SUMMARY_COLS = `
        a.id, a.url, a.canonical_url, a.source_id, a.author_id,
        a.title, a.description, a.ai_summary,
        a.url_to_image, a.video_url, a.topic, a.section, a.og_type, a.language,
        a.published_at, a.modified_at, a.scraped_at,
        a.sentiment_type, a.sentiment_score, a.sentiment_polarity,
        a.sentiment_pos, a.sentiment_neu, a.sentiment_neg, a.sentiment_model,
        a.toxicity_label, a.toxicity_score,
        a.word_count, a.reading_time_min,
        a.ai_relevance, a.ai_top_label, a.ai_label_scores,
        a.quality_metadata->>'category_model' AS category_model,
        a.is_premium, a.is_accessible_free, a.keywords
`

const ORDER_LATEST = `
      ORDER BY
        COALESCE(a.published_at, a.scraped_at, '-infinity'::timestamptz) DESC,
        COALESCE(a.scraped_at, '-infinity'::timestamptz) DESC,
        a.id DESC
`

const ORDER_OLDEST = `
      ORDER BY
        COALESCE(a.published_at, a.scraped_at, 'infinity'::timestamptz) ASC,
        COALESCE(a.scraped_at, 'infinity'::timestamptz) ASC,
        a.id ASC
`

const SENTIMENTS = new Set(['positive', 'neutral', 'negative'])
const PAGINATED_PARAMS = [
  'page',
  'pageSize',
  'fields',
  'source',
  'sentiment',
  'q',
  'sort',
  'sinceHours',
] as const

const newsCache = new PublicationCache<any>(5 * 60 * 1000, 60)

function clampInt(raw: unknown, min: number, max: number, fallback: number): number {
  const n = parseInt(String(raw), 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function buildAiModels(rows: any[]): Record<string, string> {
  const modelValues = [
    ...new Set(
      rows
        .map((row) => row.sentiment_model)
        .filter((value) => typeof value === 'string' && value.trim().length > 0),
    ),
  ]
  return Object.fromEntries(modelValues.map((model, index) => [`sentiment_${index + 1}`, model]))
}

newsRouter.get('/', async (req: Request, res: Response) => {
  try {
    // Public news changes on scraper runs, not per user. A short browser cache
    // plus stale-while-revalidate avoids repeat downloads without making the
    // feed materially stale; the server's own TTL remains authoritative.
    res.set('Cache-Control', 'no-store')

    const category = req.query.category as string | undefined
    const paginated = PAGINATED_PARAMS.some((p) => req.query[p] !== undefined)

    const body = paginated ? await paginatedResponse(req, category) : await legacyResponse(category)

    res.json(body)
  } catch (err: any) {
    logger.error({ err: err.message }, '[GET /api/news-from-db]')
    res.status(500).json({ success: false, message: 'Server Database Error' })
  }
})

// ── Legacy mode: exact retired-server.js payload ─────────────────────────────
async function legacyResponse(category: string | undefined) {
  const key = `legacy:${(category || 'all').toLowerCase()}`
  return newsCache.wrap(key, async () => {
    let queryText = `
      SELECT
        a.*, ${SOURCE_AUTHOR_COLS}
      ${JOINS} WHERE ${ACTIVE_ARTICLES}
    `
    const params: any[] = []

    if (category && category !== 'all') {
      queryText += ' AND LOWER(a.topic) = LOWER($1)'
      params.push(category)
    }

    queryText += `${ORDER_LATEST} LIMIT 400`

    const result = await query(queryText, params)

    const categories = [
      ...new Set(
        result.rows
          .map((row) => row.topic)
          .filter((value) => typeof value === 'string' && value.trim().length > 0),
      ),
    ]

    const scrapedTimestamps = result.rows
      .map((row) => new Date(row.scraped_at).getTime())
      .filter((value) => Number.isFinite(value))
    const latestScrapedAt =
      scrapedTimestamps.length > 0 ? new Date(Math.max(...scrapedTimestamps)).toISOString() : null

    return {
      status: 200,
      success: true,
      datasetStatus: 'ok',
      totalResults: result.rows.length,
      articles: result.rows,
      scrapedAt: latestScrapedAt,
      categories,
      aiModels: buildAiModels(result.rows),
    }
  })
}

// ── Paginated mode: additive contract for the React Query client ────────────
async function paginatedResponse(req: Request, category: string | undefined) {
  const page = clampInt(req.query.page, 1, 100000, 1)
  const pageSize = clampInt(req.query.pageSize, 1, 50, 20)
  const fields = req.query.fields === 'summary' ? 'summary' : 'full'
  const sortRaw = String(req.query.sort ?? '').toLowerCase()
  const sort = sortRaw === 'top' || sortRaw === 'oldest' ? sortRaw : 'latest'
  const sinceHours =
    req.query.sinceHours === undefined ? 0 : clampInt(req.query.sinceHours, 1, 168, 30)
  const sentimentRaw = String(req.query.sentiment ?? '')
    .trim()
    .toLowerCase()
  const sentiment = sentimentRaw.split(',').filter(value => SENTIMENTS.has(value))
  const sources = String(req.query.source ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  const q = String(req.query.q ?? '')
    .trim()
    .slice(0, 100)

  const key =
    'pg:' +
    JSON.stringify({
      c: (category || 'all').toLowerCase(),
      page,
      pageSize,
      fields,
      sort,
      sentiment,
      sources,
      q,
      sinceHours,
    })

  return newsCache.wrap(key, async () => {
    const where: string[] = [ACTIVE_ARTICLES]
    const params: any[] = []

    if (category && category !== 'all') {
      params.push(category.toLowerCase().split(',').map(value => value.trim()))
      where.push(`LOWER(a.topic) = ANY($${params.length}::text[])`)
    }
    if (sources.length > 0) {
      params.push(sources)
      where.push(`a.source_id = ANY($${params.length}::text[])`)
    }
    if (sentiment.length) {
      params.push(sentiment)
      where.push(`a.sentiment_type = ANY($${params.length}::text[])`)
    }
    if (q) {
      where.push(newsSearch(q, params))
    }
    if (sinceHours > 0) {
      params.push(sinceHours)
      where.push(
        `a.published_at >= NOW() - ($${params.length}::double precision * interval '1 hour')`,
      )
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

    const cols = fields === 'summary' ? SUMMARY_COLS : 'a.*'
    params.push(pageSize)
    const limitIdx = params.length
    params.push((page - 1) * pageSize)
    const offsetIdx = params.length

    let sql: string
    if (sort === 'top') {
      // Editorial front page: rank for importance, then round-robin each
      // source's 1st, 2nd, 3rd... story. This prevents a fast/high-volume
      // publisher from taking over the All Categories feed.
      sql = `
        WITH filtered AS (
          SELECT ${cols}, ${SOURCE_AUTHOR_COLS},
                 extract(epoch FROM COALESCE(a.published_at, a.scraped_at)) AS _epoch
          ${JOINS}
          ${whereSql}
        ), scored AS (
          SELECT *,
                 _epoch AS _rank_score
          FROM filtered
        ), diversified AS (
          SELECT *,
                 row_number() OVER (
                   PARTITION BY topic, source_id
                   ORDER BY _rank_score DESC,
                            COALESCE(published_at, scraped_at, '-infinity'::timestamptz) DESC
                 ) AS _source_position
          FROM scored
        )
        SELECT *,
               count(*) OVER ()::int AS _total_count,
               max(scraped_at) OVER () AS _latest_scraped
        FROM diversified
        ORDER BY _source_position ASC, _rank_score DESC,
                 COALESCE(published_at, scraped_at, '-infinity'::timestamptz) DESC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `
    } else {
      sql = `
        SELECT ${cols}, ${SOURCE_AUTHOR_COLS},
               count(*) OVER ()::int AS _total_count,
               max(a.scraped_at) OVER () AS _latest_scraped
        ${JOINS}
        ${whereSql}
        ${sort === 'oldest' ? ORDER_OLDEST : ORDER_LATEST}
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `
    }

    const result = await query(sql, params)
    // A page beyond the last row still needs the true total for pagination.
    const emptyCount = result.rows.length === 0 ? await query(`SELECT count(*)::int AS total ${JOINS} ${whereSql}`, params.slice(0, -2)) : null
    const totalCount = result.rows.length > 0 ? Number(result.rows[0]._total_count) : Number(emptyCount?.rows[0]?.total ?? 0)
    const latestRaw = result.rows.length > 0 ? result.rows[0]._latest_scraped : null
    const scrapedAt = latestRaw ? new Date(latestRaw).toISOString() : null

    const articles = result.rows.map((row) => {
      const { _total_count, _latest_scraped, _rank_score, _source_position, _epoch, ...rest } = row
      return rest
    })

    return {
      status: 200,
      success: true,
      datasetStatus: 'ok',
      totalResults: articles.length,
      totalCount,
      page,
      pageSize,
      articles,
      scrapedAt,
      categories: await distinctCategories(),
      aiModels: buildAiModels(articles),
    }
  })
}

function distinctCategories(): Promise<string[]> {
  return newsCache.wrap('categories', async () => {
    const result = await query(
      `SELECT DISTINCT topic FROM articles a
       WHERE ${ACTIVE_ARTICLES} AND topic IS NOT NULL AND btrim(topic) <> ''
       ORDER BY topic`,
    )
    return result.rows.map((r) => r.topic)
  })
}
