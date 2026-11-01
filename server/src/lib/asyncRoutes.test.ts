import { beforeEach, expect, it, vi } from 'vitest'
import express, { Router } from 'express'
import request from 'supertest'

vi.mock('../db/client', () => ({ query: vi.fn() }))
vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => { req.userId = 26; next() },
  optionalAuth: (req: any, _res: any, next: any) => { req.userId = 26; next() },
}))
import { query } from '../db/client'
import { postsRouter } from '../routes/posts'

const db = vi.mocked(query)
beforeEach(() => { db.mockReset() })

it('sends a rejected async handler to the error middleware instead of crashing the process', async () => {
  const router = Router()
  router.use(async (_req, _res, next) => { await Promise.resolve(); next() })
  router.get('/boom', async () => { throw new Error('db down') })
  const errors: unknown[] = []
  const app = express().use(router).use((err: any, _req: any, res: any, _next: any) => {
    errors.push(err)
    res.status(500).json({ success: false })
  })
  const response = await request(app).get('/boom')
  expect(response.status).toBe(500)
  expect(errors).toHaveLength(1)
})

it('answers 404 when blocking an account that does not exist', async () => {
  db.mockRejectedValueOnce(Object.assign(new Error('fk'), { code: '23503' }))
  const app = express().use(express.json()).use('/api/posts', postsRouter)
  const response = await request(app).post('/api/posts/blocks').send({ blockedUserId: 999999 })
  expect(response.status).toBe(404)
  expect(response.body.error).toBe('User not found')
})
