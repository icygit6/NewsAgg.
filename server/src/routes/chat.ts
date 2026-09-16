import { Router, Request, Response } from 'express'
import { logger } from '../lib/logger'
import { answerArticleQuestion, type ChatTurn } from '../services/groq'
import { validateBody, chatSchema } from '../middleware/validate'
import { authMiddleware } from '../middleware/auth'
import { query } from '../db/client'
import { chatLimiter } from '../middleware/rateLimit'

// POST /api/chat  { message, articleId, lang, messages? }
// The server fetches the article by ID; browser-supplied article text is never
// trusted. Authentication plus the mount-level limiter protect AI quota.
export const chatRouter = Router()

chatRouter.post('/', authMiddleware, chatLimiter, validateBody(chatSchema), async (req: Request, res: Response) => {
  const { message, articleId, lang, messages } = req.body as {
    message: string
    articleId: string
    lang: string
    messages?: ChatTurn[]
  }

  try {
    const articleResult = await query(
      'SELECT title, description, content FROM articles WHERE id = $1',
      [articleId]
    )
    if (articleResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Article not found' })
    }
    const article = articleResult.rows[0]
    const articleText = [article.title, article.description, article.content]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .join('\n\n')
    const answer = await answerArticleQuestion(message, articleText, lang, messages ?? [])
    if (!answer.reply) {
      return res.status(502).json({ success: false, message: 'No response from AI' })
    }
    return res.json({ success: true, data: answer })
  } catch (err: any) {
    logger.error({ err: err?.message }, '[POST /api/chat]')
    return res.status(500).json({ success: false, message: 'AI chat failed' })
  }
})
