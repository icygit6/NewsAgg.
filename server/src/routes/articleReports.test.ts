import { beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../db/client', () => ({ query: vi.fn() }))
vi.mock('../services/adminNotify', () => ({ notifyAdminsOfReport: vi.fn() }))
const auth = vi.hoisted(() => ({ userId: 26 as number | undefined }))
vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: any, res: any, next: any) => (auth.userId ? ((req.userId = auth.userId), next()) : res.status(401).json({ success: false, error: 'Unauthorized' })),
}))

import { query } from '../db/client'
import { articlesRouter } from './articles'
import { notifyAdminsOfReport } from '../services/adminNotify'

const mockQuery = query as unknown as ReturnType<typeof vi.fn>

function app() {
  const instance = express()
  instance.use(express.json())
  instance.use('/api/articles', articlesRouter)
  return instance
}

describe('article correction reports', () => {
  beforeEach(() => { vi.clearAllMocks(); auth.userId = 26 })

  it('refuses a guest: reporting needs an account', async () => {
    auth.userId = undefined
    const response = await request(app())
      .post('/api/articles/0123456789abcdef/report')
      .send({ reason: 'sentiment', message: 'The story is good news, not negative.' })
    expect(response.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('stores a signed-in report for an existing article', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{}] }).mockResolvedValueOnce({ rows: [] })
    const response = await request(app())
      .post('/api/articles/0123456789abcdef/report')
      .send({ reason: 'sentiment', message: 'The story is good news, not negative.' })

    expect(response.status).toBe(201)
    expect(mockQuery).toHaveBeenLastCalledWith(
      expect.stringContaining('INSERT INTO article_reports'),
      ['0123456789abcdef', 'sentiment', 'The story is good news, not negative.', 26]
    )
    expect(notifyAdminsOfReport).toHaveBeenCalledOnce()
  })

  it('rejects unknown reasons without touching the database', async () => {
    const response = await request(app())
      .post('/api/articles/0123456789abcdef/report')
      .send({ reason: 'clickbait' })

    expect(response.status).toBe(400)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns 404 when the article does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const response = await request(app())
      .post('/api/articles/0123456789abcdef/report')
      .send({ reason: 'other' })

    expect(response.status).toBe(404)
    expect(mockQuery).toHaveBeenCalledTimes(1)
  })
})
