import { beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../db/client', () => ({ query: vi.fn() }))
vi.mock('../middleware/auth', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
  optionalAuth: (_req: any, _res: any, next: any) => next(),
}))

import { query } from '../db/client'
import { postsRouter } from './posts'

const db = vi.mocked(query)
const app = express().use('/api/posts', postsRouter)
const older = { id: 1, created_at: '2026-09-01T00:00:00.000Z', like_count: 2 }
const newer = { id: 2, created_at: '2026-09-02T00:00:00.000Z', like_count: 4 }

describe('posts feed ordering', () => {
  beforeEach(() => db.mockReset())

  it('orders oldest posts first and paginates forward from the cursor', async () => {
    db.mockResolvedValueOnce({ rows: [older, newer] } as any)
      .mockResolvedValueOnce({ rows: [newer] } as any)
    const first = await request(app).get('/api/posts?sort=oldest&limit=1')
    expect(first.status).toBe(200)
    expect(db.mock.calls[0][0]).toContain('ORDER BY p.created_at ASC,p.id ASC')
    expect(first.body.data.nextCursor).toBeTruthy()

    const second = await request(app).get(`/api/posts?sort=oldest&limit=1&cursor=${first.body.data.nextCursor}`)
    expect(second.status).toBe(200)
    expect(db.mock.calls[1][0]).toContain('(p.created_at,p.id)>(')
    expect(db.mock.calls[1][1]).toContain(older.id)
  })

  it('retains newest and most-popular ordering', async () => {
    db.mockResolvedValue({ rows: [] } as any)
    await request(app).get('/api/posts?sort=latest')
    await request(app).get('/api/posts?sort=popular')
    expect(db.mock.calls[0][0]).toContain('ORDER BY p.created_at DESC,p.id DESC')
    expect(db.mock.calls[1][0]).toContain('ORDER BY like_count DESC,p.created_at DESC,p.id DESC')
  })
})
