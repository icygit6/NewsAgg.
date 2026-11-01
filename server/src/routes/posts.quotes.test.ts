import { beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../db/client', () => ({ query: vi.fn() }))
vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => { req.userId = 7; next() },
  optionalAuth: (req: any, _res: any, next: any) => { req.userId = 7; next() },
}))
import { query } from '../db/client'
import { postsRouter } from './posts'

const db = vi.mocked(query)
const app = express().use('/api/posts', postsRouter)
const articleId = '0123456789abcdef'

describe('article quote feed', () => {
  beforeEach(() => db.mockReset())

  it('scopes every cursor page to the article and preserves publication, deletion, and block filters', async () => {
    const quote = { id: 2, article_id: articleId, created_at: '2026-10-22T12:00:00Z', like_count: 0 }
    db.mockResolvedValueOnce({ rows: [quote, { ...quote, id: 1 }] } as any)
      .mockResolvedValueOnce({ rows: [{ ...quote, id: 1 }] } as any)
    const first = await request(app).get(`/api/posts?articleId=${articleId}&limit=1`)
    expect(first.status).toBe(200)
    expect(first.body.data.posts).toHaveLength(1)
    expect(first.body.data.nextCursor).toBeTruthy()

    const second = await request(app).get(`/api/posts?articleId=${articleId}&limit=1&cursor=${first.body.data.nextCursor}`)
    expect(second.status).toBe(200)
    expect(second.body.data.nextCursor).toBeNull()
    for (const [sql, params] of db.mock.calls) {
      expect(sql).toContain('p.article_id=$2')
      expect(sql).toContain('a.id IS NOT NULL')
      expect(sql).toContain('p.deleted_at IS NULL')
      expect(sql).toContain('user_blocks')
      expect(params?.[1]).toBe(articleId)
    }
    expect(db.mock.calls[1][0]).toContain('(p.created_at,p.id)<(')
  })

  it.each(['invalid', '', '0123456789abcdef&articleId=1111111111111111'])('rejects malformed or repeated article references: %s', async value => {
    const response = await request(app).get(`/api/posts?articleId=${value}`)
    expect(response.status).toBe(400)
    expect(db).not.toHaveBeenCalled()
  })
})
