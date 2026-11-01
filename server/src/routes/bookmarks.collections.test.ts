import { beforeEach, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../db/client', () => ({ query: vi.fn(), pool: {} }))
vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => { req.userId = 7; next() },
}))
import { query } from '../db/client'
import { bookmarksRouter } from './bookmarks'

const db = vi.mocked(query)
const app = express().use(express.json()).use('/api/bookmarks', bookmarksRouter)
beforeEach(() => { db.mockReset(); db.mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 } as any) })

// Deleting a collection removes its bookmarks. Saving or restoring one of them
// later must not quietly bring the deleted collection back.
it('re-saving a removed bookmark keeps its collection only while that collection still exists', async () => {
  await request(app).post('/api/bookmarks').send({ articleId: 'aaaaaaaaaaaaaaaa', articleTitle: 'T', articleUrl: 'https://x.test/a', sourceName: 'BBC', topic: 'Sport' })
  const [sql, params] = db.mock.calls[0]
  expect(sql).toContain('collection_name=CASE WHEN bookmarks.deleted_at IS NULL OR')
  expect(sql).toContain('ELSE EXCLUDED.collection_name END')
  expect(params?.[7]).toContain('Read later')
})

it('restoring a bookmark from a deleted collection files it under the first collection', async () => {
  expect((await request(app).post('/api/bookmarks/5/restore')).status).toBe(200)
  const [sql, params] = db.mock.calls[0]
  expect(sql).toMatch(/THEN collection_name ELSE COALESCE\(\(SELECT bookmark_collections\[1\]/)
  expect(params).toEqual([5, 7, expect.arrayContaining(['Read later'])])
})
