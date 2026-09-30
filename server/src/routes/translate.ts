import { Router, Request, Response } from 'express'
import { createHash } from 'node:crypto'
import { logger } from '../lib/logger'
import { query } from '../db/client'
import {
  translateArticleFields,
  translateArticlePreviews,
  translationModelVersion,
  TRANSLATION_PIPELINE_VERSION,
  SUPPORTED_LANGS,
  type ApiLang,
} from '../services/translate'
import { translateLimiter } from '../middleware/rateLimit'

// GET /api/articles/:id/translate?lang=en|id|zh-CN|zh-TW
// Cache-first: serves a stored translation if present, otherwise translates
// via the translate service and caches the result in the translations table.
export const translateRouter = Router()

translateRouter.post('/translate-previews', translateLimiter, async (req: Request, res: Response) => {
  const ids: string[] = Array.isArray(req.body?.articleIds)
    ? [...new Set<string>((req.body.articleIds as unknown[]).filter(
        (id: unknown): id is string => typeof id === 'string' && id.length > 0
      ))].slice(0, 20)
    : []
  const targetLang = req.body?.lang as ApiLang
  if (ids.length === 0 || !SUPPORTED_LANGS.includes(targetLang)) {
    return res.status(400).json({ success: false, message: 'articleIds and a supported lang are required' })
  }
  try {
    await ensurePreviewTable()
    const result = await query(
      `SELECT id, title, language FROM articles WHERE id = ANY($1::text[])`,
      [ids]
    )
    const articlesById = new Map(result.rows.map((row) => [String(row.id), row]))
    const translatable = result.rows.filter((row) => normalizeStoredLang(row.language) !== targetLang)
    const hashes = new Map(translatable.map((row) => [String(row.id), previewSourceHash(row)]))
    const cached = translatable.length === 0
      ? { rows: [] as any[] }
      : await query(
          `SELECT article_id, title, description, ai_summary, source_hash, provider, model_version
           FROM article_preview_translations
           WHERE article_id = ANY($1::text[]) AND lang = $2
             AND model_version LIKE $3`,
          [translatable.map((row) => String(row.id)), targetLang, `%:${TRANSLATION_PIPELINE_VERSION}`]
        )
    const cachedById = new Map(
      cached.rows
        .filter((row) => row.source_hash === hashes.get(String(row.article_id)))
        .map((row) => [String(row.article_id), {
          id: String(row.article_id), title: row.title, description: null,
          aiSummary: null, provider: row.provider || 'cache', cached: true,
        }])
    )
    const needsTranslation = translatable.filter((row) => !cachedById.has(String(row.id)))
    const translated = needsTranslation.length === 0
      ? []
      : await translateArticlePreviews(
          needsTranslation.map((row) => ({
            id: String(row.id), title: row.title, description: null,
            aiSummary: null,
          })),
          targetLang
        )
    for (const row of translated) {
      if (row.provider === 'none') continue
      await query(
        `INSERT INTO article_preview_translations
           (article_id, lang, title, description, ai_summary, source_hash, provider, model_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (article_id, lang) DO UPDATE SET
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           ai_summary = EXCLUDED.ai_summary,
           source_hash = EXCLUDED.source_hash,
           provider = EXCLUDED.provider,
           model_version = EXCLUDED.model_version,
           translated_at = NOW()`,
        [
          row.id, targetLang, row.title, null, null,
          hashes.get(row.id), row.provider, translationModelVersion(row.provider),
        ]
      )
    }
    const translatedById = new Map(translated.map((row) => [row.id, { ...row, description: null, aiSummary: null, cached: false }]))
    const data = ids.flatMap((id) => {
      const row = articlesById.get(id)
      if (!row) return []
      return [cachedById.get(id) ?? translatedById.get(id) ?? {
        id, title: row.title, description: null,
        aiSummary: null, provider: 'none', cached: false,
      }]
    })
    return res.json({ success: true, data })
  } catch (err: any) {
    logger.error({ err: err.message }, '[POST /api/articles/translate-previews]')
    return res.status(500).json({ success: false, message: 'Preview translation failed' })
  }
})

let previewTableReady: Promise<void> | null = null
function ensurePreviewTable(): Promise<void> {
  if (!previewTableReady) {
    previewTableReady = query(`
      CREATE TABLE IF NOT EXISTS article_preview_translations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
        lang VARCHAR(10) NOT NULL,
        title TEXT,
        description TEXT,
        ai_summary TEXT,
        source_hash VARCHAR(64) NOT NULL,
        provider VARCHAR(32) NOT NULL,
        model_version VARCHAR(128) NOT NULL,
        translated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(article_id, lang)
      );
      CREATE INDEX IF NOT EXISTS idx_preview_translations_article
        ON article_preview_translations(article_id)
    `)
      .then(() => undefined)
      .catch((err) => {
        previewTableReady = null
        throw err
      })
  }
  return previewTableReady
}

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
        source_hash VARCHAR(64),
        provider VARCHAR(32),
        model_version VARCHAR(128),
        translated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(article_id, lang)
      );
      ALTER TABLE translations ADD COLUMN IF NOT EXISTS source_hash VARCHAR(64);
      ALTER TABLE translations ADD COLUMN IF NOT EXISTS provider VARCHAR(32);
      ALTER TABLE translations ADD COLUMN IF NOT EXISTS model_version VARCHAR(128)
    `)
      .then(() => undefined)
      .catch((err) => {
        tableReady = null
        throw err
      })
  }
  return tableReady
}

function sourceHash(article: Record<string, unknown>): string {
  return createHash('sha256')
    .update(JSON.stringify({
      title: article.title ?? null,
      description: article.description ?? null,
      content: article.content ?? null,
      aiSummary: article.ai_summary ?? null,
      language: article.language ?? null,
    }))
    .digest('hex')
}

export function previewSourceHash(article: Record<string, unknown>): string {
  return createHash('sha256')
    .update(JSON.stringify({
      title: article.title ?? null,
      scope: 'title-only-v1',
      language: article.language ?? null,
    }))
    .digest('hex')
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
    const currentSourceHash = sourceHash(article)

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
      `SELECT title, description, content, ai_summary, provider, model_version
       FROM translations
       WHERE article_id = $1 AND lang = $2 AND source_hash = $3
         AND model_version LIKE $4`,
      [articleId, targetLang, currentSourceHash, `%:${TRANSLATION_PIPELINE_VERSION}`]
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
          provider: c.provider || 'cache',
          modelVersion: c.model_version,
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
      const modelVersion = translationModelVersion(translated.provider)
      await query(
        `INSERT INTO translations
           (article_id, lang, title, description, content, ai_summary, source_hash, provider, model_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (article_id, lang) DO UPDATE SET
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           content = EXCLUDED.content,
           ai_summary = EXCLUDED.ai_summary,
           source_hash = EXCLUDED.source_hash,
           provider = EXCLUDED.provider,
           model_version = EXCLUDED.model_version,
           translated_at = NOW()`,
        [
          articleId, targetLang, translated.title, translated.description,
          translated.content, translated.aiSummary, currentSourceHash,
          translated.provider, modelVersion,
        ]
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
        modelVersion: translationModelVersion(translated.provider),
      },
    })
  } catch (err: any) {
    logger.error({ err: err.message }, '[GET /api/articles/:id/translate]')
    return res.status(500).json({ success: false, message: 'Translation failed' })
  }
})
