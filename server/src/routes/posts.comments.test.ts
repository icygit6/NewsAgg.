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
const app = express().use(express.json()).use('/api/posts', postsRouter)

describe('post comments and replies', () => {
  beforeEach(() => { db.mockReset() })

  it('loads comments only for an existing post and scopes the query to that post', async () => {
    db.mockResolvedValueOnce({ rows: [{ id: 12 }] } as any)
      .mockResolvedValueOnce({ rows: [{ id: 4, post_id: 12, content: 'Hello' }] } as any)
    const response = await request(app).get('/api/posts/12/comments')
    expect(response.status).toBe(200)
    expect(response.body.data.comments).toHaveLength(1)
    expect(db.mock.calls[1][0]).toContain('c.post_id=$1 AND c.deleted_at IS NULL')
    expect(db.mock.calls[1][1]).toEqual([12, 7, 0])
  })

  it('rejects a reply to a comment on another post', async () => {
    db.mockResolvedValueOnce({ rows: [{ email_verified: true }] } as any)
      .mockResolvedValueOnce({ rows: [{ user_id: 9 }] } as any)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [] } as any)
    const response = await request(app).post('/api/posts/12/comments').send({ content: 'Reply', parentId: 99 })
    expect(response.status).toBe(400)
    expect(response.body.error).toBe('Reply target not found')
    expect(db.mock.calls.some(([sql]) => sql.includes('INSERT INTO post_comments'))).toBe(false)
  })

  it('creates a reply and returns its author and parent details', async () => {
    db.mockResolvedValueOnce({ rows: [{ email_verified: true }] } as any)
      .mockResolvedValueOnce({ rows: [{ user_id: 9 }] } as any)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ id: 4 }] } as any)
      .mockResolvedValueOnce({ rows: [{ id: 5 }] } as any)
      .mockResolvedValueOnce({ rows: [{ id: 5, parent_id: 4, parent_username: 'author', content: 'Reply' }] } as any)
    const response = await request(app).post('/api/posts/12/comments').send({ content: ' Reply ', parentId: 4 })
    expect(response.status).toBe(201)
    expect(response.body.data.parent_id).toBe(4)
    expect(db.mock.calls[4][1]).toEqual([12, 7, 4, 'Reply'])
  })

  it('only deletes a comment owned by the current user in the requested post', async () => {
    db.mockResolvedValueOnce({ rows: [] } as any)
    const response = await request(app).delete('/api/posts/12/comments/5')
    expect(response.status).toBe(404)
    expect(db.mock.calls[0][1]).toEqual([5, 12, 7])
  })
})
