import { Router, Response } from 'express'
import { logger } from '../lib/logger'
import { query } from '../db/client'
import { authMiddleware, optionalAuth } from '../middleware/auth'
import { validateBody, postSchema, postEditSchema, postCommentSchema, postReportSchema, blockUserSchema } from '../middleware/validate'
import { commentLimiter, likeLimiter, postLimiter } from '../middleware/rateLimit'
import { POST_CATEGORIES, inferPostCategory } from '../lib/postCategory'
import { isAdmin } from './admin'
import { notifyAdminsOfReport } from '../services/adminNotify'

export const postsRouter = Router()
const postId = (raw: string) => /^\d+$/.test(raw) ? Number(raw) : null
const encode = (p: any) => Buffer.from(JSON.stringify({ date: p.created_at, id: p.id, likes: p.like_count })).toString('base64url')
const decode = (raw: unknown) => { try { const v = JSON.parse(Buffer.from(String(raw), 'base64url').toString()); return v?.date && v?.id ? v : null } catch { return null } }
const base = `SELECT p.id,p.content,p.category,p.created_at,p.updated_at,p.article_id,u.id user_id,u.username,u.display_name,u.avatar,
 a.title article_title,a.url_to_image article_image,a.topic article_topic,s.name source_name,
 (SELECT count(*)::int FROM post_likes x WHERE x.post_id=p.id) like_count,
 (SELECT count(*)::int FROM post_comments c WHERE c.post_id=p.id AND c.deleted_at IS NULL) comment_count,
 EXISTS(SELECT 1 FROM post_likes x WHERE x.post_id=p.id AND x.user_id=$1) liked_by_me
 FROM posts p JOIN users u ON u.id=p.user_id LEFT JOIN articles a ON a.id=p.article_id LEFT JOIN sources s ON s.id=a.source_id`

postsRouter.get('/', optionalAuth, async (req: any, res: Response) => {
  try {
    const mine = req.query.mine === '1'
    if (mine && !req.userId) return res.status(401).json({ success: false, error: 'Sign in to view your posts' })
    const limit = /^\d+$/.test(String(req.query.limit ?? '')) ? Math.min(50, Math.max(1, Number(req.query.limit))) : 20
    const sort = req.query.sort === 'popular' ? 'popular' : req.query.sort === 'oldest' ? 'oldest' : 'latest'
    const params: any[] = [req.userId ?? null]
    const where = ['p.deleted_at IS NULL']
    if (req.query.category && req.query.category !== 'all') {
      if (!POST_CATEGORIES.includes(req.query.category)) return res.status(400).json({ success: false, error: 'Invalid category' })
      params.push(req.query.category); where.push(`p.category=$${params.length}`)
    }
    if (mine) { params.push(req.userId); where.push(`p.user_id=$${params.length}`) }
    if (req.query.username) { params.push(String(req.query.username)); where.push(`lower(u.username)=lower($${params.length})`) }
    if (req.userId) { params.push(req.userId); where.push(`NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.blocker_id=$${params.length} AND b.blocked_id=p.user_id) OR (b.blocker_id=p.user_id AND b.blocked_id=$${params.length}))`) }
    const cursor = decode(req.query.cursor)
    if (req.query.cursor && !cursor) return res.status(400).json({ success: false, error: 'Invalid cursor' })
    if (cursor) {
      if (sort === 'popular') {
        params.push(Number(cursor.likes) || 0, cursor.date, cursor.id)
        where.push(`((SELECT count(*)::int FROM post_likes x WHERE x.post_id=p.id),p.created_at,p.id)<($${params.length - 2},$${params.length - 1}::timestamptz,$${params.length})`)
      } else if (sort === 'oldest') {
        params.push(cursor.date, cursor.id)
        where.push(`(p.created_at,p.id)>($${params.length - 1}::timestamptz,$${params.length})`)
      } else {
        params.push(cursor.date, cursor.id)
        where.push(`(p.created_at,p.id)<($${params.length - 1}::timestamptz,$${params.length})`)
      }
    }
    params.push(limit + 1)
    const order = sort === 'popular' ? 'like_count DESC,p.created_at DESC,p.id DESC' : sort === 'oldest' ? 'p.created_at ASC,p.id ASC' : 'p.created_at DESC,p.id DESC'
    const result = await query(`${base} WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT $${params.length}`, params)
    const more = result.rows.length > limit
    const rows = result.rows.slice(0, limit)
    res.json({ success: true, data: { posts: rows, nextCursor: more ? encode(rows[rows.length - 1]) : null } })
  } catch (err) {
    logger.error({ err }, 'Posts fetch error')
    res.status(500).json({ success: false, error: 'Failed to load posts' })
  }
})

postsRouter.post('/', authMiddleware, postLimiter, validateBody(postSchema), async (req: any, res: Response) => {
  try {
    const verified = await query('SELECT email_verified FROM users WHERE id=$1', [req.userId])
    if (!verified.rows[0]?.email_verified) return res.status(403).json({ success: false, error: 'Verify your email before posting' })
    const attached = req.body.articleId ? (await query('SELECT topic FROM articles WHERE id=$1', [req.body.articleId])).rows[0] : null
    if (req.body.articleId && !attached) return res.status(400).json({ success: false, error: 'Attached article not found' })
    const duplicate = await query("SELECT 1 FROM posts WHERE user_id=$1 AND lower(content)=lower($2) AND created_at>now()-interval '10 minutes' AND deleted_at IS NULL", [req.userId, req.body.content])
    if (duplicate.rows[0]) return res.status(409).json({ success: false, error: 'You recently posted the same message' })
    const category = req.body.category || inferPostCategory(req.body.content, attached?.topic)
    const inserted = await query('INSERT INTO posts(user_id,article_id,content,category) VALUES($1,$2,$3,$4) RETURNING id', [req.userId, req.body.articleId ?? null, req.body.content, category])
    const row = await query(`${base} WHERE p.id=$2`, [req.userId, inserted.rows[0].id])
    res.status(201).json({ success: true, data: row.rows[0] })
  } catch (err) {
    logger.error({ err }, 'Post create error')
    res.status(500).json({ success: false, error: 'Failed to create post' })
  }
})

const commentFields = `SELECT c.id,c.post_id,c.user_id,c.parent_id,c.content,c.created_at,
 u.username,u.display_name,u.avatar,parent_user.username parent_username
 FROM post_comments c JOIN users u ON u.id=c.user_id
 LEFT JOIN post_comments parent ON parent.id=c.parent_id
 LEFT JOIN users parent_user ON parent_user.id=parent.user_id`

postsRouter.get('/:id/comments', optionalAuth, async (req: any, res: Response) => {
  const id = postId(req.params.id)
  if (!id) return res.status(404).json({ success: false, error: 'Post not found' })
  const offset = /^\d+$/.test(String(req.query.offset ?? '0')) ? Math.min(10000, Number(req.query.offset ?? 0)) : 0
  try {
    const post = await query('SELECT 1 FROM posts WHERE id=$1 AND deleted_at IS NULL', [id])
    if (!post.rows[0]) return res.status(404).json({ success: false, error: 'Post not found' })
    const params: any[] = [id, req.userId ?? null, offset]
    const result = await query(`${commentFields}
      WHERE c.post_id=$1 AND c.deleted_at IS NULL
      AND ($2::integer IS NULL OR NOT EXISTS (
        SELECT 1 FROM user_blocks b WHERE
        (b.blocker_id=$2 AND b.blocked_id=c.user_id) OR
        (b.blocker_id=c.user_id AND b.blocked_id=$2)))
      ORDER BY c.created_at DESC,c.id DESC LIMIT 31 OFFSET $3`, params)
    res.json({ success: true, data: { comments: result.rows.slice(0, 30), nextOffset: result.rows.length > 30 ? offset + 30 : null } })
  } catch (err) {
    logger.error({ err }, 'Comments fetch error')
    res.status(500).json({ success: false, error: 'Failed to load comments' })
  }
})

postsRouter.post('/:id/comments', authMiddleware, commentLimiter, validateBody(postCommentSchema), async (req: any, res: Response) => {
  const id = postId(req.params.id)
  if (!id) return res.status(404).json({ success: false, error: 'Post not found' })
  try {
    const verified = await query('SELECT email_verified FROM users WHERE id=$1', [req.userId])
    if (!verified.rows[0]?.email_verified) return res.status(403).json({ success: false, error: 'Verify your email before commenting' })
    const post = await query('SELECT user_id FROM posts WHERE id=$1 AND deleted_at IS NULL', [id])
    if (!post.rows[0]) return res.status(404).json({ success: false, error: 'Post not found' })
    const blocked = await query('SELECT 1 FROM user_blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1)', [req.userId, post.rows[0].user_id])
    if (blocked.rows[0]) return res.status(403).json({ success: false, error: 'Cannot comment on this post' })
    if (req.body.parentId) {
      const parent = await query('SELECT 1 FROM post_comments WHERE id=$1 AND post_id=$2 AND deleted_at IS NULL', [req.body.parentId, id])
      if (!parent.rows[0]) return res.status(400).json({ success: false, error: 'Reply target not found' })
    }
    const inserted = await query('INSERT INTO post_comments(post_id,user_id,parent_id,content) VALUES($1,$2,$3,$4) RETURNING id', [id, req.userId, req.body.parentId ?? null, req.body.content])
    const row = await query(`${commentFields} WHERE c.id=$1`, [inserted.rows[0].id])
    res.status(201).json({ success: true, data: row.rows[0] })
  } catch (err) {
    logger.error({ err }, 'Comment create error')
    res.status(500).json({ success: false, error: 'Failed to create comment' })
  }
})

postsRouter.delete('/:id/comments/:commentId', authMiddleware, async (req: any, res: Response) => {
  const id = postId(req.params.id)
  const commentId = postId(req.params.commentId)
  if (!id || !commentId) return res.status(404).json({ success: false, error: 'Comment not found' })
  try {
    const result = await query('UPDATE post_comments SET deleted_at=now() WHERE id=$1 AND post_id=$2 AND user_id=$3 AND deleted_at IS NULL RETURNING id', [commentId, id, req.userId])
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Comment not found' })
    res.json({ success: true })
  } catch (err) {
    logger.error({ err }, 'Comment delete error')
    res.status(500).json({ success: false, error: 'Failed to delete comment' })
  }
})

postsRouter.get('/moderation/reports', authMiddleware, async (req: any, res: Response) => {
  const moderator = await query("SELECT 1 FROM users WHERE id=$1 AND role IN ('admin','moderator')", [req.userId])
  if (!moderator.rows[0]) return res.status(403).json({ success: false, error: 'Moderator access required' })
  const reports = await query(
    `SELECT r.id,r.reason,r.details,r.status,r.created_at,p.id post_id,p.content,
     author.username author_username,reporter.username reporter_username
     FROM post_reports r JOIN posts p ON p.id=r.post_id JOIN users author ON author.id=p.user_id
     JOIN users reporter ON reporter.id=r.reporter_id WHERE r.status='open' ORDER BY r.created_at ASC LIMIT 100`)
  res.json({ success: true, data: reports.rows })
})

postsRouter.patch('/moderation/reports/:reportId', authMiddleware, async (req: any, res: Response) => {
  const reportId = postId(req.params.reportId)
  if (!reportId || !['resolved','dismissed'].includes(req.body?.status)) return res.status(400).json({ success: false, error: 'Invalid moderation action' })
  const moderator = await query("SELECT 1 FROM users WHERE id=$1 AND role IN ('admin','moderator')", [req.userId])
  if (!moderator.rows[0]) return res.status(403).json({ success: false, error: 'Moderator access required' })
  const report = await query('UPDATE post_reports SET status=$2 WHERE id=$1 RETURNING post_id', [reportId, req.body.status])
  if (!report.rows[0]) return res.status(404).json({ success: false, error: 'Report not found' })
  if (req.body.hidePost === true) await query('UPDATE posts SET deleted_at=COALESCE(deleted_at,now()) WHERE id=$1', [report.rows[0].post_id])
  res.json({ success: true })
})

postsRouter.patch('/:id', authMiddleware, validateBody(postEditSchema), async (req: any, res: Response) => {
  const id = postId(req.params.id); if (!id) return res.status(404).json({ success: false, error: 'Post not found' })
  try {
    const result = await query("UPDATE posts SET content=$3,category=$4,updated_at=now() WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL AND created_at>now()-interval '15 minutes' RETURNING id", [id, req.userId, req.body.content, req.body.category || inferPostCategory(req.body.content)])
    if (!result.rows[0]) return res.status(409).json({ success: false, error: 'Posts can only be edited for 15 minutes' })
    const row = await query(`${base} WHERE p.id=$2`, [req.userId, id])
    res.json({ success: true, data: row.rows[0] })
  } catch { res.status(500).json({ success: false, error: 'Failed to edit post' }) }
})

postsRouter.delete('/:id', authMiddleware, async (req: any, res: Response) => {
  const id = postId(req.params.id); if (!id) return res.status(404).json({ success: false, error: 'Post not found' })
  try {
    // Authors remove their own posts; admins may remove anyone's.
    const result = await query('UPDATE posts SET deleted_at=now() WHERE id=$1 AND (user_id=$2 OR $3) AND deleted_at IS NULL RETURNING id', [id, req.userId, await isAdmin(req.userId)])
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Post not found' })
    res.json({ success: true })
  } catch { res.status(500).json({ success: false, error: 'Failed to delete post' }) }
})

postsRouter.post('/:id/restore', authMiddleware, async (req: any, res: Response) => {
  const id = postId(req.params.id); if (!id) return res.status(404).json({ success: false, error: 'Post not found' })
  const result = await query('UPDATE posts SET deleted_at=NULL WHERE id=$1 AND (user_id=$2 OR $3) RETURNING id', [id, req.userId, await isAdmin(req.userId)])
  if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Post not found' })
  res.json({ success: true })
})

postsRouter.post('/:id/report', authMiddleware, validateBody(postReportSchema), async (req: any, res: Response) => {
  const id = postId(req.params.id); if (!id) return res.status(404).json({ success: false, error: 'Post not found' })
  try {
    await query('INSERT INTO post_reports(post_id,reporter_id,reason,details) VALUES($1,$2,$3,$4) ON CONFLICT(post_id,reporter_id) DO UPDATE SET reason=$3,details=$4', [id, req.userId, req.body.reason, req.body.details ?? null])
    res.status(201).json({ success: true })
    notifyAdminsOfReport(`NewsAgg: post #${id} reported (${req.body.reason})`, [`Post #${id} was reported.`, `Reason: ${req.body.reason}`, ...(req.body.details ? [`Details: ${req.body.details}`] : []), `Reporter account id: ${req.userId}`])
  } catch (err: any) { res.status(err?.code === '23503' ? 404 : 500).json({ success: false, error: err?.code === '23503' ? 'Post not found' : 'Failed to report post' }) }
})

postsRouter.post('/blocks', authMiddleware, validateBody(blockUserSchema), async (req: any, res: Response) => {
  if (req.body.blockedUserId === req.userId) return res.status(400).json({ success: false, error: 'You cannot block yourself' })
  await query('INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [req.userId, req.body.blockedUserId])
  res.status(201).json({ success: true })
})

postsRouter.post('/:id/like', authMiddleware, likeLimiter, async (req: any, res: Response) => {
  const id = postId(req.params.id); if (!id) return res.status(404).json({ success: false, error: 'Post not found' })
  try { await query('INSERT INTO post_likes(post_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [id, req.userId]); res.json({ success: true }) }
  catch (err: any) { res.status(err?.code === '23503' ? 404 : 500).json({ success: false, error: err?.code === '23503' ? 'Post not found' : 'Failed to like post' }) }
})

postsRouter.delete('/:id/like', authMiddleware, likeLimiter, async (req: any, res: Response) => {
  const id = postId(req.params.id); if (!id) return res.status(404).json({ success: false, error: 'Post not found' })
  await query('DELETE FROM post_likes WHERE post_id=$1 AND user_id=$2', [id, req.userId]); res.json({ success: true })
})
