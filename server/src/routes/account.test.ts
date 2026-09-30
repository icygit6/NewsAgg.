import { beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../db/client', () => ({
  query: vi.fn(),
  pool: { connect: vi.fn() },
}))
vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.userId = 7
    next()
  },
}))
vi.mock('../services/googleIdentity', () => ({ verifyGoogleIdToken: vi.fn() }))

import { query } from '../db/client'
import { verifyGoogleIdToken } from '../services/googleIdentity'
import { accountRouter } from './account'

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
