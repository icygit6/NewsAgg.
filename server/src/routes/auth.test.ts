import { describe, it, expect, beforeEach, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import bcrypt from 'bcryptjs'

// Mock the DB layer and mailer so these are true unit tests (no Postgres / SMTP).
vi.mock('../db/client', () => ({ query: vi.fn(), pool: { query: vi.fn() } }))
vi.mock('../services/mailer', () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}))

import { query } from '../db/client'
import { authRouter } from './auth'

const mockQuery = query as unknown as ReturnType<typeof vi.fn>

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/auth', authRouter)
  return app
}

describe('auth routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Safe default for any query the route fires (incl. fire-and-forget ones).
    mockQuery.mockResolvedValue({ rows: [] })
  })

  it('registers a new user → 201 with a token and emailVerified:false', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // duplicate check: none
      .mockResolvedValueOnce({
        rows: [{ id: 1, email: 'a@b.com', username: 'alice', avatar: null, email_verified: false }],
      }) // insert user

    const res = await request(makeApp())
      .post('/auth/register')
      .send({ email: 'a@b.com', username: 'alice', password: 'password123' })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.token).toBeTruthy()
    expect(res.body.user.emailVerified).toBe(false)
  })

  it('rejects a duplicate registration → 409 (not 200)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 5 }] }) // duplicate found

    const res = await request(makeApp())
      .post('/auth/register')
      .send({ email: 'a@b.com', username: 'alice', password: 'password123' })

    expect(res.status).toBe(409)
    expect(res.body.success).toBe(false)
  })

  it('rejects an unknown login → 401', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }) // user not found

    const res = await request(makeApp())
      .post('/auth/login')
      .send({ email: 'nobody@x.com', password: 'whatever' })

    expect(res.status).toBe(401)
  })

  it('rejects a wrong password → 401', async () => {
    const hash = await bcrypt.hash('correct-horse', 10)
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, email: 'a@b.com', username: 'alice', password: hash, email_verified: true }],
    })

    const res = await request(makeApp())
      .post('/auth/login')
      .send({ email: 'a@b.com', password: 'wrong' })

    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Invalid password')
  })

  it('answers forgot-password with a generic 200 even for unknown emails', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }) // no such user

    const res = await request(makeApp())
      .post('/auth/forgot-password')
      .send({ email: 'nobody@x.com' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.message).toMatch(/reset link/i)
  })

  it('rejects a reset with an invalid/expired token → 400', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }) // token claim matched nothing

    const res = await request(makeApp())
      .post('/auth/reset-password')
      .send({ token: 'a'.repeat(64), password: 'newpassword123' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })
})
