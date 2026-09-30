import { beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'

vi.mock('../db/client', () => ({ query: vi.fn() }))

import { query } from '../db/client'
import { authMiddleware } from './auth'

const mockQuery = query as unknown as ReturnType<typeof vi.fn>
const secret = process.env.SECRET_KEY || process.env.JWT_SECRET || 'dev-secret'

function app() {
  const instance = express()
  instance.get('/private', authMiddleware, (req: any, res) => res.json({ userId: req.userId }))
  return instance
}

describe('revocable account sessions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('accepts a signed token backed by an active server session', async () => {
    mockQuery.mockResolvedValue({ rows: [{ '?column?': 1 }] })
    const token = jwt.sign({ userId: 7, sessionId: 'active-session' }, secret)
    const response = await request(app()).get('/private').set('Authorization', `Bearer ${token}`)
    expect(response.status).toBe(200)
    expect(response.body.userId).toBe(7)
  })

  it('rejects legacy or revoked sessions', async () => {
    const legacy = jwt.sign({ userId: 7 }, secret)
    const response = await request(app()).get('/private').set('Authorization', `Bearer ${legacy}`)
    expect(response.status).toBe(401)
  })
})
