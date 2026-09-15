import { Router, Request, Response } from 'express'
import { logger } from '../lib/logger'
import { query } from '../db/client'
import { translateArticleFields, translateArticlePreviews, SUPPORTED_LANGS, type ApiLang } from '../services/translate'
import { translateLimiter } from '../middleware/rateLimit'

// GET /api/articles/:id/translate?lang=en|id|zh-CN|zh-TW
// Cache-first: serves a stored translation if present, otherwise translates
// via the translate service and caches the result in the translations table.
export const translateRouter = Router()

translateRouter.post('/translate-previews', translateLimiter, async (req: Request, res: Response) => {
  const ids = Array.isArray(req.body?.articleIds)
    ? [...new Set(req.body.articleIds.filter((id: unknown) => typeof id === 'string' && id.length > 0))].slice(0, 20)
    : []
  const targetLang = req.body?.lang as ApiLang
  if (ids.length === 0 || !SUPPORTED_LANGS.includes(targetLang)) {
    return res.status(400).json({ success: false, message: 'articleIds and a supported lang are required' })
  }
  try {
    const result = await query(
      `SELECT id, title, description, ai_summary, language FROM articles WHERE id = ANY($1::text[])`,
      [ids]
    )
    const needsTranslation = result.rows.filter((row) => normalizeStoredLang(row.language) !== targetLang)
    const translated = await translateArticlePreviews(
      needsTranslation.map((row) => ({
        id: String(row.id), title: row.title, description: row.description,
        aiSummary: row.ai_summary,
      })),
      targetLang
    )
    const translatedById = new Map(translated.map((row) => [row.id, row]))
    const data = result.rows.map((row) => translatedById.get(String(row.id)) ?? {
      id: String(row.id), title: row.title, description: row.description,
      aiSummary: row.ai_summary, provider: 'none',
    })
    return res.json({ success: true, data })
  } catch (err: any) {
    logger.error({ err: err.message }, '[POST /api/articles/translate-previews]')
    return res.status(500).json({ success: false, message: 'Preview translation failed' })
  }
})

// Lazily create the translations table. articles.id is TEXT in the live DB
// (old scraper schema), so the FK is TEXT — not UUID as CLAUDE.md's schema.sql
// suggests. The promise is memoised so the DDL runs at most once per process,
// and is reset on failure so a later request can retry.
let tableReady: Promise<void> | null = null
function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = query(`
      CREATE TABLE IF NOT EXISTS translations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
        lang VARCHAR(10) NOT NULL,
        title TEXT,
        description TEXT,
        content TEXT,
        ai_summary TEXT,
        translated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(article_id, lang)
      )
    `)
      .then(() => undefined)
      .catch((err) => {
        tableReady = null
        throw err
      })
  }
  return tableReady
}

// Maps a stored article.language value onto our 4 supported codes (best effort).
function normalizeStoredLang(lang: string | null): ApiLang | null {
  if (!lang) return null
  const l = lang.trim().toLowerCase()
  if (l === 'en' || l.startsWith('en-')) return 'en'
  if (l === 'id' || l.startsWith('id-')) return 'id'
  if (l === 'zh-tw' || l === 'zh_hant' || l === 'zh-hant') return 'zh-TW'
  if (l === 'zh-cn' || l === 'zh' || l === 'zh-hans' || l === 'zh_hans') return 'zh-CN'
  return null
}

translateRouter.get('/:id/translate', translateLimiter, async (req: Request, res: Response) => {
  const articleId = req.params.id
  const langParam = (req.query.lang as string | undefined)?.trim()

  if (!langParam || !SUPPORTED_LANGS.includes(langParam as ApiLang)) {
    return res.status(400).json({
      success: false,
      message: `Query param 'lang' must be one of: ${SUPPORTED_LANGS.join(', ')}`,
    })
  }
  const targetLang = langParam as ApiLang

  try {
    const articleRes = await query(
      `SELECT id, title, description, content, ai_summary, language
       FROM articles WHERE id = $1`,
      [articleId]
    )
    if (articleRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Article not found' })
    }
    const article = articleRes.rows[0]

    // Already in the requested language → serve the originals, no translation.
    if (normalizeStoredLang(article.language) === targetLang) {
      return res.json({
        success: true,
        data: {
          articleId,
          lang: targetLang,
          title: article.title,
          description: article.description,
          content: article.content,
          aiSummary: article.ai_summary,
          cached: false,
          autoTranslated: false,
          provider: 'none',
        },
      })
    }

    await ensureTable()

    // Cache hit?
    const cacheRes = await query(
      `SELECT title, description, content, ai_summary
       FROM translations WHERE article_id = $1 AND lang = $2`,
      [articleId, targetLang]
    )
    if (cacheRes.rows.length > 0) {
      const c = cacheRes.rows[0]
      return res.json({
        success: true,
        data: {
          articleId,
          lang: targetLang,
          title: c.title,
          description: c.description,
          content: c.content,
          aiSummary: c.ai_summary,
          cached: true,
          autoTranslated: true,
          provider: 'cache',
        },
      })
    }

    // Translate + cache.
    const translated = await translateArticleFields(
      {
        title: article.title,
        description: article.description,
        content: article.content,
        aiSummary: article.ai_summary,
      },
      targetLang
    )

    // Only persist a real translation — never cache a passthrough failure.
    if (translated.provider !== 'none') {
      await query(
        `INSERT INTO translations (article_id, lang, title, description, content, ai_summary)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (article_id, lang) DO UPDATE SET
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           content = EXCLUDED.content,
           ai_summary = EXCLUDED.ai_summary,
           translated_at = NOW()`,
        [articleId, targetLang, translated.title, translated.description, translated.content, translated.aiSummary]
      )
    }

    return res.json({
      success: true,
      data: {
        articleId,
        lang: targetLang,
        title: translated.title,
        description: translated.description,
        content: translated.content,
        aiSummary: translated.aiSummary,
        cached: false,
        autoTranslated: translated.provider !== 'none',
        provider: translated.provider,
      },
    })
  } catch (err: any) {
    logger.error({ err: err.message }, '[GET /api/articles/:id/translate]')
    return res.status(500).json({ success: false, message: 'Translation failed' })
  }
})
