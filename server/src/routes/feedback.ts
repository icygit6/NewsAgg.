import { Router, Response } from 'express'
import { query } from '../db/client'
import { logger } from '../lib/logger'
import { optionalAuth } from '../middleware/auth'
import { feedbackLimiter } from '../middleware/rateLimit'
import { feedbackSchema, validateBody } from '../middleware/validate'
import { notifyAdminsOfReport } from '../services/adminNotify'

export const feedbackRouter = Router()

const KIND_LABEL: Record<string, string> = { bug: 'Bug report', suggestion: 'Suggestion', other: 'Feedback' }

// POST /api/feedback  { kind, message, page?, contactEmail? }
// Open to every reader. Signed-in feedback keeps the account id; guests may leave
// an email so the team can reply. Stored for the admin page and emailed to admins.
feedbackRouter.post('/', feedbackLimiter, optionalAuth, validateBody(feedbackSchema), async (req: any, res: Response) => {
  const { kind, message, page, contactEmail, website } = req.body
  // Honeypot filled: a bot. Answer as if accepted so it learns nothing, store nothing.
  if (website) return res.status(201).json({ success: true })
  const email = req.userId ? null : contactEmail || null
  const userAgent = String(req.headers['user-agent'] || '').slice(0, 400) || null
  try {
    const result = await query(
      'INSERT INTO feedback (kind, message, page, contact_email, user_agent, user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [kind, message, page || null, email, userAgent, req.userId ?? null]
    )
    notifyAdminsOfReport(`NewsAgg: ${KIND_LABEL[kind]} #${result.rows[0].id}`, [
      `${KIND_LABEL[kind]} received.`,
      `Message: ${message}`,
      ...(page ? [`Page: ${page}`] : []),
      req.userId ? `From account id: ${req.userId}` : `From: guest${email ? ` (${email})` : ''}`,
      'Review it on the Admin page, Feedback tab.',
    ])
    res.status(201).json({ success: true, data: { id: result.rows[0].id } })
  } catch (err: any) {
    logger.error({ err: err?.message }, '[POST /api/feedback]')
    res.status(500).json({ success: false, error: 'Could not send your feedback' })
  }
})
