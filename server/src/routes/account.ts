import { Router, Response } from 'express'
import { logger } from '../lib/logger'
import bcrypt from 'bcryptjs'
import { pool, query } from '../db/client'
import { authMiddleware } from '../middleware/auth'
import {
  validateBody,
  profileSchema,
  backgroundSchema,
  passwordChangeSchema,
  avatarSchema,
  googleAuthSchema,
  deleteAccountSchema,
  googleDisconnectSchema,
  publicProfileSchema,
  accountPreferencesSchema,
} from '../middleware/validate'
import { verifyGoogleIdToken } from '../services/googleIdentity'
import { accountWriteLimiter } from '../middleware/rateLimit'
import { clearSessionCookie, createSession, setSessionCookie } from '../lib/session'

// Account management over the live `users` table (integer id, `password`
// column nullable for Google-only accounts, `avatar` stores a small data-URL).
// Response shape mirrors /auth: { success, user?/data?, error? }.
export const accountRouter = Router()
accountRouter.use(authMiddleware)
accountRouter.use((req, res, next) =>
  req.method === 'GET' ? next() : accountWriteLimiter(req, res, next)
)

const USER_COLS = 'id, email, username, display_name, bio, avatar, profile_background, profile_background_image, role, email_verified, created_at, last_login, google_id, password, preferred_language, email_updates, terms_accepted_at'

// Surface camelCase `emailVerified` alongside the raw snake_case row so the
// client reads one consistent field for the verify-email banner.
const shapeAccountUser = (u: any) => ({
  id: u.id,
  email: u.email,
  username: u.username,
  displayName: u.display_name,
  bio: u.bio,
  avatar: u.avatar,
  profileBackground: u.profile_background ?? 0,
  profileBackgroundImage: u.profile_background_image ?? null,
  role: u.role,
  created_at: u.created_at,
  last_login: u.last_login,
  emailVerified: u.email_verified ?? false,
  googleLinked: Boolean(u.google_id),
  hasPassword: Boolean(u.password),
  preferredLanguage: u.preferred_language ?? 'en',
  emailUpdates: u.email_updates ?? false,
  termsAccepted: Boolean(u.terms_accepted_at),
})

// GET /api/account/me — also validates the stored token on app boot.
accountRouter.get('/me', async (req: any, res: Response) => {
  try {
    const result = await query(`SELECT ${USER_COLS} FROM users WHERE id = $1`, [req.userId])
    if (result.rows.length === 0) {
      // Token of a deleted account: 401 funnels into the client's global sign-out.
      return res.status(401).json({ success: false, error: 'Account no longer exists' })
    }
    // Surface camelCase `emailVerified` alongside the raw row so the client's
    // verify-email banner reads the same field everywhere (auth + account).
    res.json({ success: true, user: shapeAccountUser(result.rows[0]) })
  } catch (err: any) {
    logger.error({ err: err?.message }, '[GET /api/account/me]')
    res.status(500).json({ success: false, error: 'Failed to load account' })
  }
})

// PATCH /api/account/profile — username only (email is the login identity).
accountRouter.patch('/profile', validateBody(profileSchema), async (req: any, res: Response) => {
  try {
    const { username } = req.body
    const clash = await query('SELECT id FROM users WHERE lower(username) = lower($1) AND id <> $2', [
      username,
      req.userId,
    ])
    if (clash.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'Username already taken' })
    }
    const result = await query(
      `UPDATE users SET username = $1 WHERE id = $2 RETURNING ${USER_COLS}`,
      [username, req.userId]
    )
    res.json({ success: true, user: shapeAccountUser(result.rows[0]) })
  } catch (err: any) {
    logger.error({ err: err?.message }, '[PATCH /api/account/profile]')
    res.status(500).json({ success: false, error: 'Failed to update profile' })
  }
})

// PATCH /api/account/password
accountRouter.patch(
  '/password',
  validateBody(passwordChangeSchema),
  async (req: any, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body
      const result = await query('SELECT password FROM users WHERE id = $1', [req.userId])
      if (result.rows.length === 0) {
        return res.status(401).json({ success: false, error: 'Account no longer exists' })
      }
      const stored = result.rows[0].password
      if (stored) {
        const ok = await bcrypt.compare(currentPassword, stored)
        if (!ok) {
          return res.status(400).json({ success: false, error: 'Current password is incorrect' })
        }
      }
      const hashed = await bcrypt.hash(newPassword, 10)
      await query('UPDATE users SET password = $1 WHERE id = $2', [hashed, req.userId])
      await query('UPDATE account_sessions SET revoked_at = now() WHERE user_id = $1', [req.userId])
      const token = await createSession(req.userId, req)
      setSessionCookie(req, res, token)
      res.json({ success: true, hasPassword: true })
    } catch (err: any) {
      logger.error({ err: err?.message }, '[PATCH /api/account/password]')
      res.status(500).json({ success: false, error: 'Failed to change password' })
    }
  }
)

// PUT /api/account/avatar — small data-URL (client downscales to ~96px webp).
accountRouter.put('/avatar', validateBody(avatarSchema), async (req: any, res: Response) => {
  try {
    const result = await query(
      'UPDATE users SET avatar = $1 WHERE id = $2 RETURNING avatar',
      [req.body.avatar, req.userId]
    )
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Account no longer exists' })
    }
    res.json({ success: true, avatar: result.rows[0].avatar })
  } catch (err: any) {
    logger.error({ err: err?.message }, '[PUT /api/account/avatar]')
    res.status(500).json({ success: false, error: 'Failed to update avatar' })
  }
})

accountRouter.put('/background', validateBody(backgroundSchema), async (req: any, res: Response) => {
  try {
    const result = await query(
      `UPDATE users SET profile_background = $1, profile_background_image = $2 WHERE id = $3 RETURNING ${USER_COLS}`,
      [req.body.background, req.body.image, req.userId]
    )
    if (!result.rows.length) return res.status(401).json({ success: false, error: 'Account no longer exists' })
    res.json({ success: true, user: shapeAccountUser(result.rows[0]) })
  } catch {
    res.status(500).json({ success: false, error: 'Failed to save profile background' })
  }
})

accountRouter.patch('/public-profile', validateBody(publicProfileSchema), async (req: any, res: Response) => {
  try {
    const result = await query(
      `UPDATE users SET display_name=$1,bio=$2
       WHERE id=$3 RETURNING ${USER_COLS}`,
      [req.body.displayName, req.body.bio, req.userId]
    )
    res.json({ success: true, user: shapeAccountUser(result.rows[0]) })
  } catch { res.status(500).json({ success: false, error: 'Failed to update public profile' }) }
})

accountRouter.patch('/preferences', validateBody(accountPreferencesSchema), async (req: any, res: Response) => {
  try {
    const preferredLanguage = req.body.preferredLanguage ?? null
    const emailUpdates = req.body.emailUpdates ?? null
    const result = await query(
      `UPDATE users
       SET preferred_language = COALESCE($1, preferred_language),
           email_updates = COALESCE($2, email_updates)
       WHERE id = $3 RETURNING ${USER_COLS}`,
      [preferredLanguage, emailUpdates, req.userId]
    )
    if (!result.rows.length) return res.status(401).json({ success: false, error: 'Account no longer exists' })
    res.json({ success: true, user: shapeAccountUser(result.rows[0]) })
  } catch (err: any) {
    logger.error({ err: err?.message }, '[PATCH /api/account/preferences]')
    res.status(500).json({ success: false, error: 'Failed to update preferences' })
  }
})

// POST /api/account/google — explicit account linking while already signed in.
// The verified Google email must match the existing NewsAgg login email.
accountRouter.post('/google', validateBody(googleAuthSchema), async (req: any, res: Response) => {
  try {
    const payload = await verifyGoogleIdToken(req.body.token)
    if (!payload.email || payload.email_verified !== true || !payload.sub) {
      return res.status(401).json({ success: false, error: 'Google account email is missing or unverified' })
    }
    const account = await query('SELECT email, google_id FROM users WHERE id = $1', [req.userId])
    if (account.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Account no longer exists' })
    }
    const user = account.rows[0]
    if (String(payload.email).toLowerCase() !== String(user.email).toLowerCase()) {
      return res.status(409).json({
        success: false,
        error: `Choose the Google account that uses ${user.email}`,
      })
    }
    if (user.google_id && user.google_id !== payload.sub) {
      return res.status(409).json({ success: false, error: 'A different Google identity is already linked' })
    }
    const result = await query(
      `UPDATE users SET google_id = $1, email_verified = true
       WHERE id = $2 RETURNING ${USER_COLS}`,
      [payload.sub, req.userId]
    )
    res.json({ success: true, user: shapeAccountUser(result.rows[0]) })
  } catch (err: any) {
    if (err?.code === '23505') {
      return res.status(409).json({ success: false, error: 'That Google account is linked to another NewsAgg account' })
    }
    logger.warn({ err: err?.message }, '[POST /api/account/google]')
    const configured = Boolean(process.env.GOOGLE_CLIENT_ID)
    res.status(configured ? 401 : 503).json({
      success: false,
      error: configured ? 'Could not verify the Google account' : 'Google sign-in is not configured',
    })
  }
})

// DELETE /api/account/google — retain at least one sign-in method.
accountRouter.delete('/google', validateBody(googleDisconnectSchema), async (req: any, res: Response) => {
  try {
    const account = await query('SELECT password, google_id FROM users WHERE id = $1', [req.userId])
    if (account.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Account no longer exists' })
    }
    if (!account.rows[0].google_id) return res.json({ success: true })
    if (!account.rows[0].password) {
      return res.status(409).json({
        success: false,
        error: 'Set a NewsAgg password before disconnecting Google so you are not locked out',
      })
    }
    const passwordOk = await bcrypt.compare(req.body.currentPassword, account.rows[0].password)
    if (!passwordOk) {
      return res.status(400).json({ success: false, error: 'Current password is incorrect' })
    }
    const result = await query(
      `UPDATE users SET google_id = NULL WHERE id = $1 RETURNING ${USER_COLS}`,
      [req.userId]
    )
    res.json({ success: true, user: shapeAccountUser(result.rows[0]) })
  } catch (err: any) {
    logger.error({ err: err?.message }, '[DELETE /api/account/google]')
    res.status(500).json({ success: false, error: 'Failed to disconnect Google account' })
  }
})

// DELETE /api/account — explicit transaction; never rely on FK CASCADE, and
// tolerate tables that only exist after later phases (comments, posts).
accountRouter.get('/sessions', async (req: any, res: Response) => {
  try {
    const result = await query(
      `SELECT token_hash, user_agent, ip_address, created_at, last_seen_at, expires_at
       FROM account_sessions
       WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC`,
      [req.userId]
    )
    res.json({
      success: true,
      sessions: result.rows.map((row: any) => ({
        current: row.token_hash === req.sessionHash,
        userAgent: row.user_agent,
        ipAddress: row.ip_address,
        createdAt: row.created_at,
        lastSeenAt: row.last_seen_at,
        expiresAt: row.expires_at,
      })),
    })
  } catch (err: any) {
    logger.error({ err: err?.message }, '[GET /api/account/sessions]')
    res.status(500).json({ success: false, error: 'Failed to load sessions' })
  }
})

accountRouter.get('/export', async (req: any, res: Response) => {
  try {
    const account = await query(
      `SELECT id, email, username, role, email_verified, personalization_enabled,
              preferred_language, email_updates, terms_accepted_at, created_at, last_login
       FROM users WHERE id = $1`,
      [req.userId]
    )
    if (account.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Account no longer exists' })
    }
    const bookmarks = await query(
      `SELECT article_id, article_title, article_url, source_name, topic, created_at
       FROM bookmarks WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.userId]
    )
    let posts: any[] = []
    const postsTable = await query("SELECT to_regclass('public.posts') AS reg")
    if (postsTable.rows[0]?.reg) {
      posts = (await query('SELECT id, content, article_id, created_at FROM posts WHERE user_id = $1 ORDER BY created_at DESC', [req.userId])).rows
    }
    res.set('Cache-Control', 'no-store')
    res.json({ success: true, data: { exportedAt: new Date().toISOString(), account: account.rows[0], bookmarks: bookmarks.rows, posts } })
  } catch (err: any) {
    logger.error({ err: err?.message }, '[GET /api/account/export]')
    res.status(500).json({ success: false, error: 'Failed to export account data' })
  }
})

accountRouter.delete('/sessions', async (req: any, res: Response) => {
  try {
    await query(
      'UPDATE account_sessions SET revoked_at = now() WHERE user_id = $1 AND token_hash <> $2',
      [req.userId, req.sessionHash]
    )
    res.json({ success: true })
  } catch (err: any) {
    logger.error({ err: err?.message }, '[DELETE /api/account/sessions]')
    res.status(500).json({ success: false, error: 'Failed to sign out other sessions' })
  }
})

accountRouter.delete('/', validateBody(deleteAccountSchema), async (req: any, res: Response) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const account = await client.query('SELECT password FROM users WHERE id = $1', [req.userId])
    if (account.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(401).json({ success: false, error: 'Account no longer exists' })
    }
    if (!account.rows[0].password) {
      await client.query('ROLLBACK')
      return res.status(409).json({ success: false, error: 'Set a NewsAgg password before deleting this account' })
    }
    const passwordOk = await bcrypt.compare(req.body.currentPassword, account.rows[0].password)
    if (!passwordOk) {
      await client.query('ROLLBACK')
      return res.status(400).json({ success: false, error: 'Current password is incorrect' })
    }

    const tableExists = async (name: string) => {
      const r = await client.query('SELECT to_regclass($1) AS reg', [`public.${name}`])
      return r.rows[0].reg !== null
    }

    await client.query('DELETE FROM bookmarks WHERE user_id = $1', [req.userId])
    if (await tableExists('comments')) {
      await client.query('DELETE FROM comments WHERE user_id = $1', [req.userId])
    }
    if (await tableExists('post_likes')) {
      await client.query('DELETE FROM post_likes WHERE user_id = $1', [req.userId])
    }
    if (await tableExists('posts')) {
      await client.query('DELETE FROM posts WHERE user_id = $1', [req.userId])
    }
    const deleted = await client.query('DELETE FROM users WHERE id = $1 RETURNING id', [
      req.userId,
    ])

    await client.query('COMMIT')
    if (deleted.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Account no longer exists' })
    }
    clearSessionCookie(req, res)
    res.json({ success: true })
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {})
    logger.error({ err: err?.message }, '[DELETE /api/account]')
    res.status(500).json({ success: false, error: 'Failed to delete account' })
  } finally {
    client.release()
  }
})
