import { Router, Request, Response } from 'express'
import { logger } from '../lib/logger'
import { query } from '../db/client'
import { PublicationCache } from '../lib/publicationCache'
import { optionalAuth } from '../middleware/auth'
import { articleReportLimiter } from '../middleware/rateLimit'
import { validateBody, articleReportSchema } from '../middleware/validate'

// GET /api/articles/:id — single full article (joined with source + author).
// The legacy client located articles by scanning the entire /api/news-from-db
// payload; this endpoint serves one row instead, so article pages stop paying
// for the whole dataset (NeonDB egress diet).
export const articlesRouter = Router()

// Live DB article ids are sha256(canonical_url)[:16] — 16 lowercase hex chars.
const ID_RE = /^[0-9a-f]{16}$/

const articleCache = new PublicationCache<any | null>(5 * 60 * 1000, 500)

// POST /api/articles/:id/report  { reason, message? }
// Reader correction route. Stores the report for team review; it never edits
// the article. Signed-in reports keep the account id, guests stay anonymous.
articlesRouter.post('/:id/report', articleReportLimiter, optionalAuth, validateBody(articleReportSchema), async (req: any, res: Response) => {
  const id = String(req.params.id || '').toLowerCase()
  if (!ID_RE.test(id)) {
    return res.status(400).json({ success: false, message: 'Invalid article id' })
  }
  const { reason, message } = req.body as { reason: string; message: string }
  try {
    const exists = await query('SELECT 1 FROM articles WHERE id = $1', [id])
    if (exists.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Article not found' })
    }
    await query(
      'INSERT INTO article_reports (article_id, reason, message, user_id) VALUES ($1, $2, $3, $4)',
      [id, reason, message, req.userId ?? null]
    )
    return res.status(201).json({ success: true })
  } catch (err: any) {
    logger.error({ err: err?.message }, '[POST /api/articles/:id/report]')
    return res.status(500).json({ success: false, message: 'Could not save the report' })
  }
})

articlesRouter.get('/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id || '').toLowerCase()
  if (!ID_RE.test(id)) {
    return res.status(400).json({ success: false, message: 'Invalid article id' })
  }

  try {
    res.set('Cache-Control', 'no-store')
    const article = await articleCache.wrap(id, async () => {
      const result = await query(
        `SELECT
           a.*,
           s.name        AS source_name,
           s.domain      AS source_domain,
           s.country     AS source_country,
           s.language    AS source_language,
           s.logo_url    AS source_logo,
           au.name       AS author_name,
           au.author_url AS author_url
         FROM articles a
         LEFT JOIN sources s  ON a.source_id = s.id
         LEFT JOIN authors au ON a.author_id = au.id
         WHERE a.id = $1`,
        [id]
      )
      return result.rows[0] ?? null
    })

    if (!article) {
      // Don't negative-cache: an article the scraper inserts seconds from now
      // should be servable immediately, not 404 for the rest of the TTL.
      articleCache.delete(id)
      return res.status(404).json({ success: false, message: 'Article not found' })
    }
    return res.json({ success: true, data: article })
  } catch (err: any) {
    logger.error({ err: err.message }, '[GET /api/articles/:id]')
    return res.status(500).json({ success: false, message: 'Server Database Error' })
  }
})
