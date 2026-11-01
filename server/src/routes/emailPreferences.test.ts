import { beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../db/client', () => ({ query: vi.fn() }))

import { query } from '../db/client'
import { signUnsubscribeToken } from '../lib/unsubscribeToken'
import { emailPreferencesRouter } from './emailPreferences'

const mockQuery = query as unknown as ReturnType<typeof vi.fn>

function app() {
  const instance = express()
  instance.use(express.json())
  instance.use(express.urlencoded({ extended: true }))
  instance.use('/api/email', emailPreferencesRouter)
  return instance
}

describe('daily email unsubscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 })
  })

  it('a GET only asks for confirmation and never changes anything', async () => {
    const token = signUnsubscribeToken(9)
    const response = await request(app()).get(`/api/email/unsubscribe?token=${token}`)
    expect(response.status).toBe(200)
    expect(response.text).toContain('<form method="post"')
    expect(response.text).toContain(`value="${token}"`)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('a POST from the confirmation form turns email updates off for that user', async () => {
    const token = signUnsubscribeToken(9)
    const response = await request(app()).post('/api/email/unsubscribe').type('form').send({ token })
    expect(response.status).toBe(200)
    expect(response.text).toContain('You are unsubscribed')
    expect(mockQuery).toHaveBeenCalledWith('UPDATE users SET email_updates = false WHERE id = $1', [9])
  })

  it('accepts the RFC 8058 one-click POST a mail client sends to the link itself', async () => {
    const token = signUnsubscribeToken(12)
    const response = await request(app())
      .post(`/api/email/unsubscribe?token=${token}`)
      .type('form')
      .send('List-Unsubscribe=One-Click')
    expect(response.status).toBe(200)
    expect(mockQuery).toHaveBeenCalledWith('UPDATE users SET email_updates = false WHERE id = $1', [12])
  })

  it('answers JSON to API callers', async () => {
    const response = await request(app())
      .post(`/api/email/unsubscribe?token=${signUnsubscribeToken(3)}`)
      .set('Accept', 'application/json')
    expect(response.body).toEqual({ success: true })
  })

  it('is idempotent: using the link twice is fine', async () => {
    const token = signUnsubscribeToken(4)
    const first = await request(app()).post(`/api/email/unsubscribe?token=${token}`)
    const second = await request(app()).post(`/api/email/unsubscribe?token=${token}`)
    expect([first.status, second.status]).toEqual([200, 200])
  })

  it('refuses a forged or missing token without touching the database', async () => {
    const [id] = signUnsubscribeToken(5).split('.')
    for (const token of [`${id}.${'A'.repeat(43)}`, 'garbage', undefined]) {
      const post = await request(app()).post(`/api/email/unsubscribe${token ? `?token=${token}` : ''}`)
      const get = await request(app()).get(`/api/email/unsubscribe${token ? `?token=${token}` : ''}`)
      expect([post.status, get.status]).toEqual([400, 400])
    }
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('reports a database failure instead of pretending it worked', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'))
    const response = await request(app()).post(`/api/email/unsubscribe?token=${signUnsubscribeToken(6)}`)
    expect(response.status).toBe(500)
    expect(response.text).not.toContain('You are unsubscribed')
  })
})
