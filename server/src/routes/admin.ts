import { Router, Response, NextFunction } from 'express'
import { logger } from '../lib/logger'
import { query } from '../db/client'
import { authMiddleware } from '../middleware/auth'

// Site administration for accounts whose users.role is 'admin'. Every route
// re-reads the role from the database, so revoking it takes effect at once.
export const adminRouter = Router()

export async function isAdmin(userId: unknown): Promise<boolean> {
  if (userId == null) return false
  const result = await query("SELECT 1 FROM users WHERE id = $1 AND role = 'admin'", [userId])
  return result.rows.length > 0
}

async function requireAdmin(req: any, res: Response, next: NextFunction) {
  try {
    if (await isAdmin(req.userId)) return next()
    res.status(403).json({ success: false, error: 'Admin access required' })
  } catch (err: any) {
    logger.error({ err: err?.message }, '[admin] role check failed')
    res.status(500).json({ success: false, error: 'Admin check failed' })
  }
}

adminRouter.use(authMiddleware, requireAdmin)
adminRouter.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next() })

const numericId = (raw: string) => (/^\d+$/.test(raw) ? Number(raw) : null)

// Nginx auth_request target guarding /dbviewer/; the body is never shown.
adminRouter.get('/check', (_req, res) => { res.status(204).end() })

adminRouter.get('/permissions', async (req: any, res) => {
  const result = await query('SELECT can_manage_roles FROM users WHERE id=$1', [req.userId])
  res.json({ success: true, data: { canManageRoles: result.rows[0]?.can_manage_roles === true } })
})

adminRouter.patch('/users/:id/role', async (req: any, res) => {
  const id = numericId(req.params.id)
  if (!id || !['user', 'admin'].includes(req.body?.role)) return res.status(400).json({ success: false, error: 'Invalid role' })
  const result = await query(`UPDATE users SET role=$2 WHERE id=$1 AND can_manage_roles=false
    AND EXISTS(SELECT 1 FROM users owner WHERE owner.id=$3 AND owner.role='admin' AND owner.can_manage_roles=true) RETURNING id`, [id, req.body.role, req.userId])
  if (!result.rows.length) return res.status(403).json({ success: false, error: 'Only the primary admin can assign roles; primary admins are protected' })
  res.json({ success: true })
})

adminRouter.get('/deleted-content', async (req, res) => {
  const offset = Math.max(0, Math.min(100000, Number(req.query.offset) || 0))
  const result = await query(`SELECT h.*, actor.username AS deleted_by_username, author.username AS author_username
    FROM moderation_history h LEFT JOIN users actor ON actor.id=h.actor_id LEFT JOIN users author ON author.id=h.author_id
    WHERE ($2::integer IS NULL OR h.post_id=$2) ORDER BY h.id DESC LIMIT 50 OFFSET $1`, [Math.floor(offset), typeof req.query.postId === 'string' ? numericId(req.query.postId) : null])
  res.json({ success: true, data: result.rows })
})

adminRouter.get('/overview', async (_req, res: Response) => {
  try {
    const counts = await query(`SELECT
      (SELECT count(*)::int FROM users) AS users,
      (SELECT count(*)::int FROM posts WHERE deleted_at IS NULL) AS posts,
      (SELECT count(*)::int FROM articles) AS articles,
      (SELECT count(*)::int FROM article_reports WHERE status = 'open') AS open_article_reports,
      (SELECT count(*)::int FROM post_reports WHERE status = 'open') AS open_post_reports,
      (SELECT count(*)::int FROM feedback WHERE status = 'open') AS open_feedback,
      pg_database_size(current_database())::bigint AS database_bytes`)
    const tables = await query(`SELECT c.relname AS name, c.reltuples::bigint AS estimated_rows,
      pg_total_relation_size(c.oid)::bigint AS bytes
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY pg_total_relation_size(c.oid) DESC`)
    const row = counts.rows[0]
    res.json({ success: true, data: { ...row, database_bytes: Number(row.database_bytes), tables: tables.rows.map((t: any) => ({ ...t, estimated_rows: Math.max(0, Number(t.estimated_rows)), bytes: Number(t.bytes) })) } })
  } catch (err: any) {
    logger.error({ err: err?.message }, '[admin] overview failed')
    res.status(500).json({ success: false, error: 'Failed to load overview' })
  }
})

adminRouter.get('/reports', async (_req, res: Response) => {
  try {
    const articleReports = await query(`SELECT r.id, r.article_id, r.reason, r.message, r.status, r.created_at,
      a.title AS article_title, u.username AS reporter_username
      FROM article_reports r LEFT JOIN articles a ON a.id = r.article_id LEFT JOIN users u ON u.id = r.user_id
      ORDER BY (r.status = 'open') DESC, r.created_at DESC LIMIT 100`)
    const postReports = await query(`SELECT r.id, r.reason, r.details, r.status, r.created_at, p.id AS post_id, p.content,
      p.deleted_at IS NOT NULL AS post_deleted, author.username AS author_username, reporter.username AS reporter_username
      FROM post_reports r JOIN posts p ON p.id = r.post_id JOIN users author ON author.id = p.user_id
      JOIN users reporter ON reporter.id = r.reporter_id
      ORDER BY (r.status = 'open') DESC, r.created_at DESC LIMIT 100`)
    res.json({ success: true, data: { articleReports: articleReports.rows, postReports: postReports.rows } })
  } catch (err: any) {
    logger.error({ err: err?.message }, '[admin] reports failed')
    res.status(500).json({ success: false, error: 'Failed to load reports' })
  }
})

adminRouter.patch('/article-reports/:id', async (req: any, res: Response) => {
  const id = numericId(req.params.id)
  if (!id || !['open', 'resolved', 'rejected'].includes(req.body?.status)) return res.status(400).json({ success: false, error: 'Invalid report action' })
  const result = await query('UPDATE article_reports SET status = $2 WHERE id = $1 RETURNING id', [id, req.body.status])
  if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Report not found' })
  res.json({ success: true })
})

adminRouter.patch('/post-reports/:id', async (req: any, res: Response) => {
  const id = numericId(req.params.id)
  if (!id || !['open', 'resolved', 'dismissed'].includes(req.body?.status)) return res.status(400).json({ success: false, error: 'Invalid report action' })
  const result = await query('UPDATE post_reports SET status = $2 WHERE id = $1 RETURNING post_id', [id, req.body.status])
  if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Report not found' })
  if (req.body.hidePost === true) await query('UPDATE posts SET deleted_at = now(), deleted_by=$2 WHERE id = $1 AND deleted_at IS NULL', [result.rows[0].post_id, req.userId])
  res.json({ success: true })
})

// Feedback from readers: newest first, open items before handled ones.
adminRouter.get('/feedback', async (_req, res: Response) => {
  try {
    const rows = await query(`SELECT f.id, f.kind, f.message, f.page, f.contact_email, f.user_agent, f.status, f.created_at,
      u.username, u.email AS account_email
      FROM feedback f LEFT JOIN users u ON u.id = f.user_id
      ORDER BY (f.status = 'open') DESC, f.created_at DESC LIMIT 300`)
    res.json({ success: true, data: rows.rows })
  } catch (err: any) {
    logger.error({ err: err?.message }, '[admin] feedback failed')
    res.status(500).json({ success: false, error: 'Could not load feedback' })
  }
})

adminRouter.patch('/feedback/:id', async (req: any, res: Response) => {
  const id = numericId(req.params.id)
  if (!id || !['open', 'reviewed', 'resolved'].includes(req.body?.status)) return res.status(400).json({ success: false, error: 'Invalid feedback action' })
  const result = await query('UPDATE feedback SET status = $2 WHERE id = $1 RETURNING id', [id, req.body.status])
  if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Feedback not found' })
  res.json({ success: true })
})

adminRouter.get('/users', async (_req, res: Response) => {
  try {
    const users = await query(`SELECT u.id, u.username, u.display_name, u.email, u.role, u.can_manage_roles, u.email_verified,
      u.google_id IS NOT NULL AS google_account, u.created_at, u.last_login,
      (SELECT count(*)::int FROM posts p WHERE p.user_id = u.id AND p.deleted_at IS NULL) AS posts,
      (SELECT count(*)::int FROM post_reports r JOIN posts p ON p.id = r.post_id WHERE p.user_id = u.id) AS reports_against
      FROM users u ORDER BY u.created_at DESC`)
    res.json({ success: true, data: users.rows })
  } catch (err: any) {
    logger.error({ err: err?.message }, '[admin] users failed')
    res.status(500).json({ success: false, error: 'Failed to load users' })
  }
})

// Permanently removes an account; its sessions, posts, comments, likes,
// bookmarks and blocks cascade. Admin accounts cannot be removed here.
adminRouter.delete('/users/:id', async (req: any, res: Response) => {
  const id = numericId(req.params.id)
  if (!id) return res.status(404).json({ success: false, error: 'User not found' })
  if (String(id) === String(req.userId)) return res.status(400).json({ success: false, error: 'You cannot delete your own account here' })
  try {
    const result = await query("DELETE FROM users WHERE id = $1 AND role IS DISTINCT FROM 'admin' RETURNING id", [id])
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'User not found or is an admin' })
    logger.info({ adminId: req.userId, deletedUserId: id }, '[admin] user deleted')
    res.json({ success: true })
  } catch (err: any) {
    logger.error({ err: err?.message }, '[admin] user delete failed')
    res.status(500).json({ success: false, error: 'Failed to delete user' })
  }
})
