import { Router, Response } from 'express'
import { logger } from '../lib/logger'
import { query } from '../db/client'
import { authMiddleware } from '../middleware/auth'
import { validateBody, bookmarkSchema, bookmarkUpdateSchema } from '../middleware/validate'

export const bookmarksRouter = Router()
bookmarksRouter.use(authMiddleware)

const columns = `id, article_id, article_title, article_url, url_to_image, source_name,
  topic, collection_name, notes, is_read, archived, created_at`
const id = (raw: string) => /^\d+$/.test(raw) ? Number(raw) : null
const encode = (row: any) => Buffer.from(JSON.stringify({ value: row.created_at, id: row.id })).toString('base64url')
const decode = (raw: unknown) => {
  try { const v = JSON.parse(Buffer.from(String(raw), 'base64url').toString()); return v?.value && v?.id ? v : null } catch { return null }
}

bookmarksRouter.post('/', validateBody(bookmarkSchema), async (req: any, res: Response) => {
  try {
    const { articleId, articleTitle, articleUrl, urlToImage, sourceName, topic } = req.body
    const result = await query(
      `INSERT INTO bookmarks (user_id, article_id, article_title, article_url, url_to_image, source_name, topic)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (user_id, article_id) DO UPDATE SET deleted_at=NULL, archived=false
       RETURNING ${columns}`,
      [req.userId, articleId, articleTitle, articleUrl, urlToImage || null, sourceName, topic]
    )
    res.status(201).json({ success: true, data: result.rows[0] })
  } catch (error) {
    logger.error({ err: error }, 'Bookmark add error')
    res.status(500).json({ success: false, error: 'Failed to add bookmark' })
  }
})

bookmarksRouter.get('/ids', async (req: any, res: Response) => {
  try {
    const result = await query('SELECT id, article_id FROM bookmarks WHERE user_id=$1 AND deleted_at IS NULL', [req.userId])
    res.json({ success: true, data: result.rows })
  } catch (error) {
    logger.error({ err: error }, 'Bookmark ids error')
    res.status(500).json({ success: false, error: 'Failed to load bookmarks' })
  }
})

bookmarksRouter.get('/meta', async (req: any, res: Response) => {
  try {
    const result = await query(
      `SELECT count(*)::int total,
       COALESCE(array_agg(DISTINCT collection_name ORDER BY collection_name), '{}') collections,
       COALESCE(array_agg(DISTINCT source_name ORDER BY source_name) FILTER (WHERE source_name IS NOT NULL), '{}') sources,
       COALESCE(array_agg(DISTINCT topic ORDER BY topic) FILTER (WHERE topic IS NOT NULL), '{}') topics
       FROM bookmarks WHERE user_id=$1 AND deleted_at IS NULL`, [req.userId])
    res.json({ success: true, data: result.rows[0] })
  } catch (error) {
    logger.error({ err: error }, 'Bookmark metadata error')
    res.status(500).json({ success: false, error: 'Failed to load bookmark filters' })
  }
})

bookmarksRouter.get('/', async (req: any, res: Response) => {
  try {
    const limit = /^\d+$/.test(String(req.query.limit ?? '')) ? Math.min(50, Math.max(1, Number(req.query.limit))) : 20
    const values: any[] = [req.userId]
    const where = ['user_id=$1', 'deleted_at IS NULL']
    const add = (sql: string, value: unknown) => { values.push(value); where.push(sql.replace('?', `$${values.length}`)) }
    if (req.query.collection) add('collection_name=?', String(req.query.collection))
    if (req.query.source) add('source_name=?', String(req.query.source))
    if (req.query.topic) add('topic=?', String(req.query.topic))
    if (req.query.status === 'unread') where.push('is_read=false AND archived=false')
    if (req.query.status === 'read') where.push('is_read=true AND archived=false')
    if (req.query.status === 'archived') where.push('archived=true')
    if (req.query.search) {
      values.push(`%${String(req.query.search).slice(0, 100)}%`)
      where.push(`(article_title ILIKE $${values.length} OR source_name ILIKE $${values.length} OR notes ILIKE $${values.length})`)
    }
    const cursor = decode(req.query.cursor)
    if (req.query.cursor && !cursor) return res.status(400).json({ success: false, error: 'Invalid cursor' })
    if (cursor) {
      values.push(cursor.value, cursor.id)
      where.push(`(created_at,id) < ($${values.length - 1}::timestamptz,$${values.length})`)
    }
    values.push(limit + 1)
    const result = await query(`SELECT ${columns} FROM bookmarks WHERE ${where.join(' AND ')} ORDER BY created_at DESC,id DESC LIMIT $${values.length}`, values)
    const hasMore = result.rows.length > limit
    const rows = result.rows.slice(0, limit)
    res.json({ success: true, data: { bookmarks: rows, nextCursor: hasMore ? encode(rows[rows.length - 1]) : null } })
  } catch (error) {
    logger.error({ err: error }, 'Bookmarks fetch error')
    res.status(500).json({ success: false, error: 'Failed to load bookmarks' })
  }
})

bookmarksRouter.patch('/:bookmarkId', validateBody(bookmarkUpdateSchema), async (req: any, res: Response) => {
  const bookmarkId = id(req.params.bookmarkId)
  if (!bookmarkId) return res.status(404).json({ success: false, error: 'Bookmark not found' })
  try {
    const result = await query(
      `UPDATE bookmarks SET collection_name=COALESCE($3,collection_name), notes=COALESCE($4,notes),
       is_read=COALESCE($5,is_read), archived=COALESCE($6,archived)
       WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL RETURNING ${columns}`,
      [bookmarkId, req.userId, req.body.collectionName, req.body.notes, req.body.isRead, req.body.archived])
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Bookmark not found' })
    res.json({ success: true, data: result.rows[0] })
  } catch (error) {
    logger.error({ err: error }, 'Bookmark update error')
    res.status(500).json({ success: false, error: 'Failed to update bookmark' })
  }
})

bookmarksRouter.delete('/:bookmarkId', async (req: any, res: Response) => {
  const bookmarkId = id(req.params.bookmarkId)
  if (!bookmarkId) return res.status(404).json({ success: false, error: 'Bookmark not found' })
  try {
    const result = await query('UPDATE bookmarks SET deleted_at=NOW() WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL RETURNING id', [bookmarkId, req.userId])
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Bookmark not found' })
    res.json({ success: true })
  } catch (error) {
    logger.error({ err: error }, 'Bookmark delete error')
    res.status(500).json({ success: false, error: 'Failed to remove bookmark' })
  }
})

bookmarksRouter.post('/:bookmarkId/restore', async (req: any, res: Response) => {
  const bookmarkId = id(req.params.bookmarkId)
  if (!bookmarkId) return res.status(404).json({ success: false, error: 'Bookmark not found' })
  try {
    const result = await query('UPDATE bookmarks SET deleted_at=NULL WHERE id=$1 AND user_id=$2 RETURNING id', [bookmarkId, req.userId])
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Bookmark not found' })
    res.json({ success: true })
  } catch (error) {
    logger.error({ err: error }, 'Bookmark restore error')
    res.status(500).json({ success: false, error: 'Failed to restore bookmark' })
  }
})
