import { beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../db/client', () => ({ query: vi.fn() }))

import { query } from '../db/client'
import { articlesRouter } from './articles'

const mockQuery = query as unknown as ReturnType<typeof vi.fn>

function app() {
  const instance = express()
  instance.use(express.json())
  instance.use('/api/articles', articlesRouter)
  return instance
}

describe('article correction reports', () => {
  beforeEach(() => vi.clearAllMocks())

  it('stores a guest report for an existing article', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{}] }).mockResolvedValueOnce({ rows: [] })
    const response = await request(app())
      .post('/api/articles/0123456789abcdef/report')
      .send({ reason: 'sentiment', message: 'The story is good news, not negative.' })

    expect(response.status).toBe(201)
    expect(mockQuery).toHaveBeenLastCalledWith(
      expect.stringContaining('INSERT INTO article_reports'),
      ['0123456789abcdef', 'sentiment', 'The story is good news, not negative.', null]
    )
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
