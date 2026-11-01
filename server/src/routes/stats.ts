import { reportingAuthors } from '../lib/reportingAuthors'
import { newsSearch } from '../lib/newsSearch'
import { Router, Request, Response } from 'express'
import { logger } from '../lib/logger'
import { pool, query } from '../db/client'
import { PublicationCache } from '../lib/publicationCache'
import { ACTIVE_ARTICLES } from '../lib/articleQuality'
import { NLP_MODELS, serviceModels } from '../lib/nlpModels'
import { FALLBACK_CHAT_MODEL, PRIMARY_CHAT_MODEL } from '../services/groq'
import { GEMINI_MODEL } from '../services/translate'
import { sourceSentiments } from '../lib/sourceSentiments'
import { buildSentimentEvidence } from '../lib/sentimentEvidence'

// Aggregate analytics endpoints so the client widgets no longer pull the full
// article dataset just to count things. All SQL-side, 5-minute TTL cache.
export const statsRouter = Router()

statsRouter.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

const statsCache = new PublicationCache<any>(5 * 60 * 1000, 40)

// One cheap revision check refreshes all active news widgets together.
statsRouter.get('/revision', async (_req: Request, res: Response) => {
  try {
    const result = await query('SELECT revision::text FROM public.publication_state WHERE singleton=true')
    const revision = result.rows[0]?.revision
    if (typeof revision !== 'string') throw new Error('Publication state unavailable')
    res.json({ success: true, data: { revision } })
  } catch {
    res.status(503).json({ success: false, message: 'Publication status unavailable' })
  }
})

function sourceScope(raw: unknown) {
  return [...new Set(String(raw ?? '').split(',').map(s => s.trim()).filter(Boolean))].sort()
}
function addSources(where: string, params: any[], sources: string[], req: Request) {
  if (sources.length) {
    params.push(sources)
    where += ` AND a.source_id = ANY($${params.length}::text[])`
  }
  const sentiments = String(req.query.sentiment ?? '').split(',').filter(s => ['positive', 'neutral', 'negative'].includes(s))
  if (sentiments.length) {
    params.push(sentiments)
    where += ` AND a.sentiment_type=ANY($${params.length}::text[])`
  }
  const search = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 200) : ''
  if (search) {
    where += ` AND (${newsSearch(search, params)})`
  }
  return where
}

// Public operational counts only: never return URLs, credentials or raw errors.
statsRouter.get('/scraper-status', async (_req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store')
  try {
    const result = await query('SELECT started_at, finished_at, status, report FROM scraper_runs ORDER BY started_at DESC LIMIT 1')
    const row = result.rows[0]
    if (!row) return res.json({ success: true, data: null })
    const counts = Object.fromEntries(Object.entries(row.report || {}).filter(([key,value]) =>
      /^(inserted|updated|unchanged|quarantined|errors|deficit_[a-z_]+_[A-Za-z]+|rejected_[a-z_]+)$/.test(key) && typeof value === 'number' && Number.isFinite(value)))
    return res.json({ success:true, data:{ startedAt:row.started_at, finishedAt:row.finished_at, status:row.status, counts } })
  } catch {
    return res.status(503).json({ success:false, message:'Scraper status unavailable' })
  }
})

const TOPICS = new Set([
  'Sport', 'Health', 'Business', 'World', 'Politics', 'Lifestyle', 'Science', 'Climate',
])

/** Normalise ?category= (client lowercase ids) to a live Title-case topic. */
function topicParam(raw: unknown): string | null {
  const s = String(raw ?? '').trim().toLowerCase()
  if (!s || s === 'all') return null
  const title = s.charAt(0).toUpperCase() + s.slice(1)
  return TOPICS.has(title) ? title : null
}

// Generic keyword noise that should never appear in "trending".
const KEYWORD_STOPLIST = new Set([
  'news', 'article', 'story', 'video', 'update', 'latest', 'breaking', 'live',
  'cnn', 'bbc', 'aljazeera', 'yahoo', 'read', 'watch', 'report', 'reports',
  'said', 'says', 'year', 'years', 'people', 'world', 'time', 'today',
  'president', 'government', 'official', 'officials', 'week', 'new',
  // Newsroom boilerplate from Chinese bylines and attributions
  // ("記者XXX／台北報導", "綜合報導", "表示", "指出").
  '記者', '報導', '綜合', '編輯', '新聞', '中心', '表示', '指出', '今天', '今年', '目前',
  // Function words the keyword extractor sometimes keeps.
  'like', 'also', 'just', 'one', 'two', 'first', 'last', 'could', 'would',
  '我們', '他們', '你們', '一個', '這個', '那個', '可以', '沒有', '已經', '因為', '如果', '還是', '不是', '就是', '自己', '這樣',
])

// GET /api/stats/overview?category=
// One row of aggregates: totals, sentiment distribution, source count, latest
// scrape time, distinct categories and the sentiment models in use.
statsRouter.get('/overview', async (req: Request, res: Response) => {
  try {
    const topic = String(req.query.category ?? '').split(',').map(topicParam).filter(Boolean)
    const sources = sourceScope(req.query.sources)
    const body = await statsCache.wrap(`overview:${topic ?? 'all'}:${JSON.stringify([sources, req.query.sentiment, req.query.q])}`, async () => {
      const snapshot = await pool.connect()
      try {
      await snapshot.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
      const query = (sql: string, values?: any[]) => snapshot.query(sql, values)
      const params: any[] = []
      let where = `WHERE ${ACTIVE_ARTICLES}`
      if (topic.length) {
        params.push(topic)
        where += ` AND a.topic = ANY($1::text[])`
      }
      where = addSources(where, params, sources, req)
      const agg = await query(
        `
        SELECT
          count(*)::int                                                AS total,
          count(*) FILTER (WHERE a.sentiment_type = 'positive')::int  AS positive,
          count(*) FILTER (WHERE a.sentiment_type = 'neutral')::int   AS neutral,
          count(*) FILTER (WHERE a.sentiment_type = 'negative')::int  AS negative,
          count(DISTINCT a.source_id)::int                            AS source_count,
          max(a.scraped_at)                                           AS latest_scraped_at,
          count(DISTINCT a.sentiment_model)::int                      AS model_count
        FROM articles a ${where}
        `,
        params
      )
      const kw = await query(
        `
        SELECT count(DISTINCT lower(k))::int AS keyword_count
        FROM articles a, jsonb_array_elements_text(a.keywords) AS k
        ${where ? `${where} AND` : 'WHERE'} jsonb_typeof(a.keywords) = 'array'
        `,
        params
      )
      // Every category's sentiment split in one pass, so Insights can rank all
      // categories at once instead of rotating through them one per request.
      const categories = await query(
        `SELECT a.topic,
                count(*)::int                                               AS total,
                count(*) FILTER (WHERE a.sentiment_type = 'positive')::int AS positive,
                count(*) FILTER (WHERE a.sentiment_type = 'neutral')::int  AS neutral,
                count(*) FILTER (WHERE a.sentiment_type = 'negative')::int AS negative
         FROM articles a
         ${where} AND a.topic IS NOT NULL AND btrim(a.topic) <> ''
         GROUP BY a.topic
         ORDER BY total DESC, a.topic`, params
      )
      const models = await query(
        `SELECT DISTINCT sentiment_model FROM articles a
         ${where} AND sentiment_model IS NOT NULL AND btrim(sentiment_model) <> '' ORDER BY sentiment_model`, params
      )
      const row = agg.rows[0]
      const evidenceRows = await query(
        `SELECT a.id, a.title, left(a.description, 1200) AS description, a.topic, a.sentiment_type, a.language, a.source_id, s.name AS source_name, s.domain AS source_domain, au.name AS author_name
         FROM articles a LEFT JOIN sources s ON s.id = a.source_id LEFT JOIN authors au ON au.id = a.author_id ${where} ORDER BY a.published_at DESC NULLS LAST, a.id`, params
      )
      const result = {
        success: true,
        data: {
          total: row.total,
          nlpModels: NLP_MODELS,
          serviceModels: serviceModels({ primary: PRIMARY_CHAT_MODEL, fallback: FALLBACK_CHAT_MODEL }, GEMINI_MODEL),
          sentiments: { positive: row.positive, neutral: row.neutral, negative: row.negative },
          reportingAuthors: reportingAuthors(evidenceRows.rows),
          evidence: buildSentimentEvidence(evidenceRows.rows),
          bySource: sourceSentiments(evidenceRows.rows),
          sourceCount: row.source_count,
          keywordCount: kw.rows[0]?.keyword_count ?? 0,
          scrapedAt: row.latest_scraped_at ? new Date(row.latest_scraped_at).toISOString() : null,
          categories: categories.rows.map((r) => r.topic).sort(),
          byCategory: categories.rows.map((r) => ({
            topic: r.topic,
            total: r.total,
            sentiments: { positive: r.positive, neutral: r.neutral, negative: r.negative },
            evidence: buildSentimentEvidence(evidenceRows.rows.filter(article => article.topic === r.topic)),
            bySource: sourceSentiments(evidenceRows.rows.filter(article => article.topic === r.topic)),
          })),
          aiModels: Object.fromEntries(
            models.rows.map((r, i) => [`sentiment_${i + 1}`, r.sentiment_model])
          ),
        },
      }
      await snapshot.query('COMMIT')
      return result
      } catch (error) {
        await snapshot.query('ROLLBACK')
        throw error
      } finally {
        snapshot.release()
      }
    })
    res.json(body)
  } catch (err: any) {
    logger.error({ err: err.message }, '[GET /api/stats/overview]')
    res.status(500).json({ success: false, message: 'Server Database Error' })
  }
})

// GET /api/stats/trending?limit=&category=
// Keyword frequencies from the JSONB keywords arrays, stoplist-filtered.
statsRouter.get('/trending', async (req: Request, res: Response) => {
  try {
    const topic = String(req.query.category ?? '').split(',').map(topicParam).filter(Boolean)
    const sources = sourceScope(req.query.sources)
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit), 10) || 10))
    const body = await statsCache.wrap(`trending:${topic ?? 'all'}:${limit}:${JSON.stringify([sources, req.query.sentiment, req.query.q])}`, async () => {
      const params: any[] = []
      let where = `WHERE ${ACTIVE_ARTICLES} AND jsonb_typeof(a.keywords) = 'array'`
      if (topic.length) {
        params.push(topic)
        where += ` AND a.topic = ANY($${params.length}::text[])`
      }
      where = addSources(where, params, sources, req)
      const result = await query(
        `
        SELECT lower(kw) AS keyword, mode() WITHIN GROUP (ORDER BY kw) AS label, count(*)::int AS count
        FROM articles a, jsonb_array_elements_text(a.keywords) AS kw
        ${where}
        GROUP BY lower(kw)
        ORDER BY count DESC, keyword ASC
        LIMIT 200
        `,
        params
      )
      const items = result.rows
        .filter((r) => r.keyword.length >= 2 && r.keyword.length <= 40 && !/^\d+$/.test(r.keyword) && !KEYWORD_STOPLIST.has(r.keyword))
        .slice(0, limit)
      return { success: true, data: items }
    })
    res.json(body)
  } catch (err: any) {
    logger.error({ err: err.message }, '[GET /api/stats/trending]')
    res.status(500).json({ success: false, message: 'Server Database Error' })
  }
})

// GET /api/stats/business-trend?days=14&category=business
// Per-day article count + average sentiment polarity — feeds the Business
// trend chart (bars = volume, line = tone).
statsRouter.get('/business-trend', async (req: Request, res: Response) => {
  try {
    const topic = topicParam(req.query.category) ?? 'Business'
    const days = Math.min(60, Math.max(3, parseInt(String(req.query.days), 10) || 14))
    const body = await statsCache.wrap(`trend:${topic}:${days}`, async () => {
      const result = await query(
        `
        SELECT
          date_trunc('day', COALESCE(a.published_at, a.scraped_at))::date AS day,
          count(*)::int                                                   AS articles,
          round(avg(COALESCE(a.sentiment_polarity, 0))::numeric, 4)      AS avg_polarity
        FROM articles a
        WHERE a.topic = $1
          AND ${ACTIVE_ARTICLES}
          AND COALESCE(a.published_at, a.scraped_at) >= NOW() - ($2 || ' days')::interval
        GROUP BY 1
        ORDER BY 1
        `,
        [topic, String(days)]
      )
      return {
        success: true,
        data: result.rows.map((r) => ({
          day: r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day),
          articles: r.articles,
          avgPolarity: Number(r.avg_polarity),
        })),
      }
    })
    res.json(body)
  } catch (err: any) {
    logger.error({ err: err.message }, '[GET /api/stats/business-trend]')
    res.status(500).json({ success: false, message: 'Server Database Error' })
  }
})
