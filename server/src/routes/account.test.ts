import { beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../db/client', () => ({
  query: vi.fn(),
  pool: { connect: vi.fn() },
}))
vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    if (req.headers.authorization === 'Bearer expired') return res.status(401).json({ success: false })
    req.userId = 7
    next()
  },
  hasSessionToken: (req: any) => Boolean(req.headers.authorization || req.headers.cookie),
}))
vi.mock('../services/googleIdentity', () => ({ verifyGoogleIdToken: vi.fn() }))
vi.mock('../services/mailer', () => ({ sendSetPasswordEmail: vi.fn(), sendPasswordResetEmail: vi.fn(), sendVerificationEmail: vi.fn(), sendAdminReportEmail: vi.fn() }))

import { query } from '../db/client'
import { verifyGoogleIdToken } from '../services/googleIdentity'
import { accountRouter } from './account'
import { sendSetPasswordEmail } from '../services/mailer'
import bcrypt from 'bcryptjs'

const mockQuery = query as unknown as ReturnType<typeof vi.fn>
const mockVerify = verifyGoogleIdToken as unknown as ReturnType<typeof vi.fn>

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/account', accountRouter)
  return app
}

describe('Google account controls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery.mockResolvedValue({ rows: [] })
  })

  it('saves an account-owned background preset', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 7, username: 'user', profile_background: 3 }] })
    const res = await request(makeApp()).put('/api/account/background').send({ background: 3 })
    expect(res.status).toBe(200)
    expect(res.body.user.profileBackground).toBe(3)
    expect(mockQuery.mock.calls[0][1]).toEqual([3, null, 7])
  })

  it('rejects arbitrary profile background values before a database write', async () => {
    const res = await request(makeApp()).put('/api/account/background').send({ background: 6 })
    expect(res.status).toBe(400)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('rejects script-capable and falsely labelled background uploads', async () => {
    for (const image of ['data:image/svg+xml;base64,PHN2Zz4=', 'data:image/webp;base64,PHN2Zz4=']) {
      const res = await request(makeApp()).put('/api/account/background').send({ background: 0, image })
      expect(res.status).toBe(400)
    }
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('saves an uploaded PNG against the authenticated account', async () => {
    const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 7, profile_background: 0, profile_background_image: image }] })
    const res = await request(makeApp()).put('/api/account/background').send({ background: 0, image })
    expect(res.status).toBe(200)
    expect(res.body.user.profileBackgroundImage).toBe(image)
    expect(mockQuery.mock.calls[0][1]).toEqual([0, image, 7])
  })

  it('links a server-verified Google identity with the same email', async () => {
    mockVerify.mockResolvedValue({ sub: 'google-123', email: 'user@example.com', email_verified: true })
    mockQuery
      .mockResolvedValueOnce({ rows: [{ email: 'user@example.com', google_id: null }] })
      .mockResolvedValueOnce({
        rows: [{ id: 7, email: 'user@example.com', username: 'user', google_id: 'google-123', password: 'hash', email_verified: true }],
      })

    const res = await request(makeApp()).post('/api/account/google').send({ token: 'valid-google-credential' })

    expect(res.status).toBe(200)
    expect(res.body.user.googleLinked).toBe(true)
    expect(res.body.user.hasPassword).toBe(true)
  })

  it('refuses to link a Google identity with a different email', async () => {
    mockVerify.mockResolvedValue({ sub: 'google-123', email: 'other@example.com', email_verified: true })
    mockQuery.mockResolvedValueOnce({ rows: [{ email: 'user@example.com', google_id: null }] })

    const res = await request(makeApp()).post('/api/account/google').send({ token: 'valid-google-credential' })

    expect(res.status).toBe(409)
    expect(res.body.error).toContain('user@example.com')
  })

  it('prevents a Google-only account from disconnecting and becoming locked out', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ password: null, google_id: 'google-123' }] })

    const res = await request(makeApp()).delete('/api/account/google')

    expect(res.status).toBe(409)
    expect(res.body.error).toContain('password')
  })
})

describe('boot-time session check', () => {
  beforeEach(() => vi.clearAllMocks())

  it('answers a signed-out visitor with user: null instead of 401', async () => {
    const res = await request(makeApp()).get('/api/account/me')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, user: null })
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('still rejects a present but invalid session', async () => {
    const res = await request(makeApp()).get('/api/account/me').set('Authorization', 'Bearer expired')
    expect(res.status).toBe(401)
  })
})

describe('password changes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery.mockResolvedValue({ rows: [] })
  })

  it('never lets a session set the first password of a Google-only account', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ password: null }] })
    const response = await request(makeApp()).patch('/api/account/password').send({ newPassword: 'a-new-password' })
    expect(response.status).toBe(403)
    expect(response.body.code).toBe('PASSWORD_LINK_REQUIRED')
    expect(mockQuery).toHaveBeenCalledTimes(1)
  })

  it('requires the current password and a different new one', async () => {
    const stored = await bcrypt.hash('old-password', 4)
    mockQuery.mockResolvedValueOnce({ rows: [{ password: stored }] })
    const wrong = await request(makeApp()).patch('/api/account/password').send({ currentPassword: 'guess', newPassword: 'another-password' })
    expect(wrong.status).toBe(400)
    mockQuery.mockResolvedValueOnce({ rows: [{ password: stored }] })
    const same = await request(makeApp()).patch('/api/account/password').send({ currentPassword: 'old-password', newPassword: 'old-password' })
    expect(same.status).toBe(400)
  })

  it('emails a set-password link to a Google-only account', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ email: 'reader@example.com', password: null }] })
    const response = await request(makeApp()).post('/api/account/password-link')
    expect(response.status).toBe(200)
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO auth_tokens'), expect.arrayContaining([7, 'reset']))
    expect(sendSetPasswordEmail).toHaveBeenCalledWith('reader@example.com', expect.any(String))
  })

  it('refuses the link when a password already exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ email: 'reader@example.com', password: 'hash' }] })
    const response = await request(makeApp()).post('/api/account/password-link')
    expect(response.status).toBe(409)
    expect(sendSetPasswordEmail).not.toHaveBeenCalled()
  })
})
