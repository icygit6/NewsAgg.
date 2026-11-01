import { beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'

vi.mock('../db/client', () => ({ query: vi.fn() }))
vi.mock('../services/groq', () => ({
  answerArticleQuestion: vi.fn().mockResolvedValue({
    reply: 'The answer is supported [1].',
    citations: [{ index: 1, text: 'Stored database passage.' }],
  }),
}))

import { query } from '../db/client'
import { answerArticleQuestion } from '../services/groq'
import { chatRouter } from './chat'

const mockQuery = query as unknown as ReturnType<typeof vi.fn>
const mockAnswer = answerArticleQuestion as unknown as ReturnType<typeof vi.fn>

function app() {
  const instance = express()
  instance.use(express.json())
  instance.use('/api/chat', chatRouter)
  return instance
}

describe('article chat route', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requires authentication', async () => {
    const response = await request(app()).post('/api/chat').send({
      articleId: '0123456789abcdef', message: 'What happened?', lang: 'en',
    })
    expect(response.status).toBe(401)
  })

  it('does not send quarantined article text to the model', async () => {
    mockQuery.mockImplementation(async (sql: string) => ({ rows: sql.includes('account_sessions') ? [{ exists: 1 }] : [] }))
    const token = jwt.sign({ userId: 7, sessionId: 'test-session' }, process.env.SECRET_KEY || process.env.JWT_SECRET || 'dev-secret')
    const response = await request(app()).post('/api/chat').set('Authorization', `Bearer ${token}`)
      .send({ articleId: '0123456789abcdef', message: 'What happened?', lang: 'en' })
    expect(response.status).toBe(404)
    expect(mockAnswer).not.toHaveBeenCalled()
    expect(mockQuery.mock.calls.find(([sql]) => sql.includes('FROM articles'))?.[0]).toContain('content_review_status')
  })

  it('loads trusted article text from the database and returns citations', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ title: 'Stored title', description: 'Stored deck', content: 'Stored body' }],
    })
    const token = jwt.sign({ userId: 7, sessionId: 'test-session' }, process.env.SECRET_KEY || process.env.JWT_SECRET || 'dev-secret')
    const response = await request(app())
      .post('/api/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ articleId: '0123456789abcdef', message: 'What happened?', lang: 'en' })

    expect(response.status).toBe(200)
    expect(mockAnswer).toHaveBeenCalledWith(
      'What happened?', 'Stored title\n\nStored deck\n\nStored body', 'en', []
    )
    expect(response.body.data.citations).toHaveLength(1)
  })
})
