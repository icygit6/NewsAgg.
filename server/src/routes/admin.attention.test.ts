import { beforeEach, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../db/client', () => ({ query: vi.fn() }))
vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => { req.userId = 26; next() },
}))
import { query } from '../db/client'
import { adminRouter } from './admin'

const db = vi.mocked(query)
const app = express().use('/api/admin', adminRouter)
beforeEach(() => { db.mockReset() })

it('serves the navigation badge from three counts, without the database size scan', async () => {
  db.mockResolvedValueOnce({ rows: [{ role: 'admin' }] } as any) // the admin check
  db.mockResolvedValueOnce({ rows: [{ open_article_reports: 2, open_post_reports: 1, open_feedback: 3 }] } as any)
  const res = await request(app).get('/api/admin/attention')
  expect(res.status).toBe(200)
  expect(res.body.data).toEqual({ open_article_reports: 2, open_post_reports: 1, open_feedback: 3 })
  const sql = String(db.mock.calls[1][0])
  expect(sql).not.toMatch(/pg_database_size|pg_total_relation_size/)
  expect(res.headers['cache-control']).toBe('private, no-store')
})

it('keeps the counts private to admins', async () => {
  db.mockResolvedValueOnce({ rows: [] } as any)
  expect((await request(app).get('/api/admin/attention')).status).toBe(403)
  expect(db).toHaveBeenCalledTimes(1)
})
