import { Router, Response } from 'express'
import { logger } from '../lib/logger'
import { authMiddleware } from '../middleware/auth'
import { query } from '../db/client'
import { validateBody, personalizationSchema, readingHistorySchema } from '../middleware/validate'

// Mem0-backed personalization. mem0 is imported lazily inside handlers so a
// missing/broken SDK can't crash the server, and the service degrades safely.
export const userRouter = Router()
userRouter.use(authMiddleware)

// GET /api/user/preferences
userRouter.get('/preferences', async (req: any, res: Response) => {
  try {
    const account = await query('SELECT personalization_enabled FROM users WHERE id = $1', [req.userId])
    const enabled = account.rows[0]?.personalization_enabled !== false
    if (!enabled) return res.json({ success: true, data: { enabled: false, topics: [] } })
    const { getPersonalizedTopics } = await import('../services/mem0')
    const topics = await getPersonalizedTopics(String(req.userId))
    res.json({ success: true, data: { enabled: true, topics } })
  } catch (err: any) {
    logger.error({ err: err?.message }, '[GET /api/user/preferences]')
    res.json({ success: true, data: { topics: [] } })
  }
})

// POST /api/user/reading-history
userRouter.patch('/preferences', validateBody(personalizationSchema), async (req: any, res: Response) => {
  try {
    await query('UPDATE users SET personalization_enabled = $1 WHERE id = $2', [req.body.enabled, req.userId])
    res.json({ success: true, data: { enabled: req.body.enabled } })
  } catch (err: any) {
    logger.error({ err: err?.message }, '[PATCH /api/user/preferences]')
    res.status(500).json({ success: false, error: 'Failed to update preferences' })
  }
})

userRouter.delete('/reading-history', async (req: any, res: Response) => {
  try {
    const { clearUserInterests } = await import('../services/mem0')
    await clearUserInterests(String(req.userId))
    res.json({ success: true })
  } catch (err: any) {
    logger.error({ err: err?.message }, '[DELETE /api/user/reading-history]')
    res.status(503).json({ success: false, error: 'Could not clear personalization data' })
  }
})

userRouter.post('/reading-history', validateBody(readingHistorySchema), async (req: any, res: Response) => {
  try {
    const account = await query('SELECT personalization_enabled FROM users WHERE id = $1', [req.userId])
    if (account.rows[0]?.personalization_enabled === false) {
      return res.json({ success: true, skipped: true })
    }
    const { topic, sentiment, keywords } = req.body || {}
    const { saveUserInterest } = await import('../services/mem0')
    await saveUserInterest(String(req.userId), { topic, sentiment, keywords: keywords || [] })
    res.json({ success: true })
  } catch (err: any) {
    logger.error({ err: err?.message }, '[POST /api/user/reading-history]')
    res.json({ success: false })
  }
})
