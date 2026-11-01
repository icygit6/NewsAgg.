import { Router, Response } from 'express'
import { logger } from '../lib/logger'
import { pool, query } from '../db/client'
import { authMiddleware } from '../middleware/auth'
import { validateBody, bookmarkSchema, bookmarkUpdateSchema, collectionCreateSchema, collectionDeleteSchema, collectionRenameSchema } from '../middleware/validate'

export const bookmarksRouter = Router()
bookmarksRouter.use(authMiddleware)

const columns = `id, article_id, article_title, article_url, url_to_image, source_name,
  topic, collection_name, notes, is_read, archived, created_at`
// A name that differs only in case joins the collection the user already has.
const existingCollection = (userParam: string, nameParam: string) =>
  `(SELECT b2.collection_name FROM bookmarks b2 WHERE b2.user_id=${userParam} AND b2.deleted_at IS NULL
    AND lower(b2.collection_name)=lower(${nameParam}) ORDER BY b2.created_at LIMIT 1)`
// Starting list for readers who never edited theirs. The client translates
// these English names; anything a reader types is shown as written.
const DEFAULT_COLLECTIONS = ['Read later', 'Research', 'Follow this story', 'Share', 'Reference']
const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
type Client = { query: (text: string, params?: any[]) => Promise<any> }

async function inTransaction<T>(work: (client: Client) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

/** The reader's collection list, locked so concurrent edits apply in turn. */
async function lockedList(client: Client, userId: number): Promise<string[]> {
  const result = await client.query('SELECT bookmark_collections FROM users WHERE id=$1 FOR UPDATE', [userId])
  return result.rows[0]?.bookmark_collections ?? [...DEFAULT_COLLECTIONS]
}

const saveList = (client: Client, userId: number, list: string[]) =>
  client.query('UPDATE users SET bookmark_collections=$2 WHERE id=$1',
    [userId, list.filter((name, i) => list.findIndex((other) => sameName(other, name)) === i)])

/** The spelling the reader already uses for this name, if any (ignoring case). */
async function resolveName(client: Client, userId: number, name: string, list: string[], except?: string) {
  const used = await client.query('SELECT DISTINCT collection_name FROM bookmarks WHERE user_id=$1 AND deleted_at IS NULL', [userId])
  const known = [...list, ...used.rows.map((row: any) => row.collection_name as string)]
  return known.find((other) => other !== except && sameName(other, name)) ?? name
}

const list = (raw: unknown) => String(raw ?? '').split(',').map((value) => value.trim().toLowerCase()).filter((value) => value && value.length <= 40).slice(0, 12)
const id = (raw: string) => /^\d+$/.test(raw) ? Number(raw) : null
const encode = (row: any) => Buffer.from(JSON.stringify({ value: row.created_at, id: row.id })).toString('base64url')
const decode = (raw: unknown) => {
  try { const v = JSON.parse(Buffer.from(String(raw), 'base64url').toString()); return v?.value && v?.id ? v : null } catch { return null }
}

bookmarksRouter.post('/', validateBody(bookmarkSchema), async (req: any, res: Response) => {
  try {
    const { articleId, articleTitle, articleUrl, urlToImage, sourceName, topic } = req.body
    const result = await query(
      `INSERT INTO bookmarks (user_id, article_id, article_title, article_url, url_to_image, source_name, topic, collection_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE((SELECT bookmark_collections[1] FROM users WHERE id=$1),'Read later'))
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
       count(*) FILTER (WHERE NOT archived AND NOT is_read)::int unread,
       count(*) FILTER (WHERE NOT archived AND is_read)::int read,
       count(*) FILTER (WHERE archived)::int archived,
       COALESCE(array_agg(DISTINCT collection_name ORDER BY collection_name), '{}') collections,
       (SELECT COALESCE(bookmark_collections, $2) FROM users WHERE id=$1) presets,
       (SELECT COALESCE(json_object_agg(collection_name, n), '{}') FROM (SELECT collection_name, count(*)::int n FROM bookmarks
         WHERE user_id=$1 AND deleted_at IS NULL GROUP BY 1) c) collection_counts,
       COALESCE(array_agg(DISTINCT source_name ORDER BY source_name) FILTER (WHERE source_name IS NOT NULL), '{}') sources,
       COALESCE(array_agg(DISTINCT topic ORDER BY topic) FILTER (WHERE topic IS NOT NULL), '{}') topics
       FROM bookmarks WHERE user_id=$1 AND deleted_at IS NULL`, [req.userId, DEFAULT_COLLECTIONS])
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
    // Multi-select filters from the shared filter panel, as comma lists.
    const sources = list(req.query.sources)
    if (sources.length) add('source_name IN (SELECT name FROM sources WHERE id = ANY(?))', sources)
    const categories = list(req.query.categories)
    if (categories.length) add('lower(topic) = ANY(?)', categories)
    // Sentiment lives on the saved article, not the bookmark.
    const sentiments = list(req.query.sentiments).filter((value) => ['positive', 'neutral', 'negative'].includes(value))
    if (sentiments.length) add('(SELECT a.sentiment_type FROM articles a WHERE a.id=bookmarks.article_id) = ANY(?)', sentiments)
    if (req.query.status === 'unread') where.push('is_read=false AND archived=false')
    if (req.query.status === 'read') where.push('is_read=true AND archived=false')
    if (req.query.status === 'archived') where.push('archived=true')
    // Archiving hides a bookmark: the default list shows only active ones.
    if (!['unread', 'read', 'archived'].includes(String(req.query.status ?? ''))) where.push('archived=false')
    if (req.query.search) {
      values.push(`%${String(req.query.search).slice(0, 100)}%`)
      where.push(`(article_title ILIKE $${values.length} OR source_name ILIKE $${values.length} OR notes ILIKE $${values.length})`)
    }
    const cursor = decode(req.query.cursor)
    if (req.query.cursor && !cursor) return res.status(400).json({ success: false, error: 'Invalid cursor' })
    const oldest = req.query.sort === 'oldest'
    if (cursor) {
      values.push(cursor.value, cursor.id)
      where.push(`(created_at,id) ${oldest ? '>' : '<'} ($${values.length - 1}::timestamptz,$${values.length})`)
    }
    values.push(limit + 1)
    const order = oldest ? 'created_at ASC,id ASC' : 'created_at DESC,id DESC'
    // Card details the home feed shows, read from the saved article (gone once
    // cleanup removes it) and the source.
    const result = await query(`SELECT ${columns},
      (SELECT a.sentiment_type FROM articles a WHERE a.id=bookmarks.article_id) sentiment,
      (SELECT a.reading_time_min FROM articles a WHERE a.id=bookmarks.article_id) reading_time_min,
      (SELECT a.published_at FROM articles a WHERE a.id=bookmarks.article_id) published_at,
      (SELECT s.domain FROM sources s WHERE s.name=bookmarks.source_name LIMIT 1) source_domain
      FROM bookmarks WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT $${values.length}`, values)
    const hasMore = result.rows.length > limit
    const rows = result.rows.slice(0, limit)
    res.json({ success: true, data: { bookmarks: rows, nextCursor: hasMore ? encode(rows[rows.length - 1]) : null } })
  } catch (error) {
    logger.error({ err: error }, 'Bookmarks fetch error')
    res.status(500).json({ success: false, error: 'Failed to load bookmarks' })
  }
})

bookmarksRouter.post('/collections', validateBody(collectionCreateSchema), async (req: any, res: Response) => {
  try {
    const name = await inTransaction(async (client) => {
      const list = await lockedList(client, req.userId)
      const name = await resolveName(client, req.userId, req.body.name, list)
      if (!list.some((item) => sameName(item, name))) await saveList(client, req.userId, [...list, name])
      return name
    })
    res.status(201).json({ success: true, data: { name } })
  } catch (error) {
    logger.error({ err: error }, 'Collection create error')
    res.status(500).json({ success: false, error: 'Failed to create collection' })
  }
})

bookmarksRouter.post('/collections/rename', validateBody(collectionRenameSchema), async (req: any, res: Response) => {
  const { from } = req.body
  try {
    const result = await inTransaction(async (client) => {
      const list = await lockedList(client, req.userId)
      // Renaming onto another existing collection (any case) merges the two.
      const to = await resolveName(client, req.userId, req.body.to, list, from)
      const moved = await client.query('UPDATE bookmarks SET collection_name=$3 WHERE user_id=$1 AND collection_name=$2', [req.userId, from, to])
      const listed = list.includes(from)
      if (!listed && !moved.rowCount) return null
      if (listed) await saveList(client, req.userId, list.map((item) => item === from ? to : item))
      return { name: to, moved: moved.rowCount }
    })
    if (!result) return res.status(404).json({ success: false, error: 'Collection not found' })
    res.json({ success: true, data: result })
  } catch (error) {
    logger.error({ err: error }, 'Collection rename error')
    res.status(500).json({ success: false, error: 'Failed to rename collection' })
  }
})

bookmarksRouter.post('/collections/delete', validateBody(collectionDeleteSchema), async (req: any, res: Response) => {
  const { name, moveTo } = req.body
  try {
    const result = await inTransaction(async (client) => {
      const list = await lockedList(client, req.userId)
      const target = moveTo ? await resolveName(client, req.userId, moveTo, list, name) : null
      if (target === name) return 'same'
      const affected = target
        ? await client.query('UPDATE bookmarks SET collection_name=$3 WHERE user_id=$1 AND collection_name=$2 AND deleted_at IS NULL', [req.userId, name, target])
        : await client.query('UPDATE bookmarks SET deleted_at=NOW() WHERE user_id=$1 AND collection_name=$2 AND deleted_at IS NULL', [req.userId, name])
      const listed = list.includes(name)
      if (!listed && !affected.rowCount) return null
      if (listed) await saveList(client, req.userId, list.filter((item) => item !== name))
      return { moveTo: target, moved: target ? affected.rowCount : 0, deleted: target ? 0 : affected.rowCount }
    })
    if (result === 'same') return res.status(400).json({ success: false, error: 'Choose a different collection' })
    if (!result) return res.status(404).json({ success: false, error: 'Collection not found' })
    res.json({ success: true, data: result })
  } catch (error) {
    logger.error({ err: error }, 'Collection delete error')
    res.status(500).json({ success: false, error: 'Failed to delete collection' })
  }
})

bookmarksRouter.patch('/:bookmarkId', validateBody(bookmarkUpdateSchema), async (req: any, res: Response) => {
  const bookmarkId = id(req.params.bookmarkId)
  if (!bookmarkId) return res.status(404).json({ success: false, error: 'Bookmark not found' })
  try {
    const result = await query(
      `UPDATE bookmarks SET collection_name=COALESCE(${existingCollection('$2', '$3::text')},$3,collection_name), notes=COALESCE($4,notes),
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
