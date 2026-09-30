import { Router, Response } from 'express'
import { query } from '../db/client'

export const profilesRouter = Router()

profilesRouter.get('/:username', async (req, res: Response) => {
  try {
    const result = await query(
      `SELECT u.id,u.username,u.display_name,u.bio,u.avatar,u.profile_background,u.profile_background_image,u.created_at,
       count(DISTINCT p.id)::int post_count,count(DISTINCT (l.post_id,l.user_id))::int like_count
       FROM users u LEFT JOIN posts p ON p.user_id=u.id AND p.deleted_at IS NULL
       LEFT JOIN post_likes l ON l.post_id=p.id
       WHERE lower(u.username)=lower($1)
       GROUP BY u.id`, [req.params.username])
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Profile not found' })
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
    res.json({ success: true, data: result.rows[0] })
  } catch { res.status(500).json({ success: false, error: 'Failed to load profile' }) }
})
