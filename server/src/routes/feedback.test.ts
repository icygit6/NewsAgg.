import { beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'

const state = vi.hoisted(() => ({ userId: undefined as number | undefined }))

vi.mock('../db/client', () => ({ query: vi.fn() }))
vi.mock('../services/adminNotify', () => ({ notifyAdminsOfReport: vi.fn() }))
// The real limiter is exercised by its own test below; elsewhere it would cap the suite at five requests.
vi.mock('../middleware/rateLimit', async (original) => ({ ...(await original<typeof import('../middleware/rateLimit')>()), feedbackLimiter: (_req: any, _res: any, next: any) => next() }))
vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => { req.userId = 26; next() },
  optionalAuth: (req: any, _res: any, next: any) => { req.userId = state.userId; next() },
}))

import { query } from '../db/client'
import { notifyAdminsOfReport } from '../services/adminNotify'
import { feedbackRouter } from './feedback'
import { adminRouter } from './admin'

const db = vi.mocked(query)
const notify = vi.mocked(notifyAdminsOfReport)
const app = express().use(express.json()).use('/api/feedback', feedbackRouter).use('/api/admin', adminRouter)

describe('POST /api/feedback', () => {
  beforeEach(() => {
    db.mockReset(); notify.mockReset(); state.userId = undefined
    db.mockResolvedValue({ rows: [{ id: 41 }] } as any)
  })

  it('stores a guest bug report with its page and contact email, and tells the admins', async () => {
    const response = await request(app).post('/api/feedback').set('User-Agent', 'TestBrowser/1.0')
      .send({ kind: 'bug', message: 'The filter panel will not close on my phone.', page: '/posts', contactEmail: 'reader@example.com' })
    expect(response.status).toBe(201)
    expect(response.body).toEqual({ success: true, data: { id: 41 } })
    const [sql, params] = db.mock.calls[0]
    expect(sql).toContain('INSERT INTO feedback')
    expect(params).toEqual(['bug', 'The filter panel will not close on my phone.', '/posts', 'reader@example.com', 'TestBrowser/1.0', null])
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify.mock.calls[0][0]).toBe('NewsAgg: Bug report #41')
    expect(notify.mock.calls[0][1].join('\n')).toContain('From: guest (reader@example.com)')
  })

  it('keeps the account for a signed-in sender and does not store an email they typed', async () => {
    state.userId = 7
    await request(app).post('/api/feedback').send({ kind: 'suggestion', message: 'A dark mode for the email would be nice.', contactEmail: 'other@example.com' })
    const params = db.mock.calls[0][1] as unknown[]
    expect(params[3]).toBeNull()
    expect(params[5]).toBe(7)
    expect(notify.mock.calls[0][1].join('\n')).toContain('From account id: 7')
  })

  it.each([
    ['an unknown kind', { kind: 'praise', message: 'Lovely site overall.' }],
    ['a message that is too short', { kind: 'other', message: 'hi' }],
    ['a message over 2000 characters', { kind: 'other', message: 'x'.repeat(2001) }],
    ['a malformed contact email', { kind: 'bug', message: 'Something broke here.', contactEmail: 'not-an-email' }],
  ])('rejects %s without touching the database', async (_label, body) => {
    const response = await request(app).post('/api/feedback').send(body)
    expect(response.status).toBe(400)
    expect(db).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
  })

  it('accepts an empty contact email as "none given"', async () => {
    await request(app).post('/api/feedback').send({ kind: 'other', message: 'Just saying thanks.', contactEmail: '' })
    expect((db.mock.calls[0][1] as unknown[])[3]).toBeNull()
  })

  it('answers a bot that filled the hidden field as if accepted, but stores and sends nothing', async () => {
    const response = await request(app).post('/api/feedback').send({ kind: 'bug', message: 'Buy cheap things now!!!', website: 'https://spam.example' })
    expect(response.status).toBe(201)
    expect(db).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
  })

  it('reports a database failure honestly', async () => {
    db.mockReset(); db.mockRejectedValueOnce(new Error('db down'))
    const response = await request(app).post('/api/feedback').send({ kind: 'bug', message: 'Something broke here.' })
    expect(response.status).toBe(500)
    expect(notify).not.toHaveBeenCalled()
  })
})

describe('feedback rate limit', () => {
  it('allows five sends per address in fifteen minutes, then answers 429', async () => {
    const { feedbackLimiter } = await vi.importActual<typeof import('../middleware/rateLimit')>('../middleware/rateLimit')
    const limited = express().use(express.json()).post('/f', feedbackLimiter, (_req, res) => { res.status(201).json({ success: true }) })
    const codes = []
    for (let n = 0; n < 6; n++) codes.push((await request(limited).post('/f').send({})).status)
    expect(codes).toEqual([201, 201, 201, 201, 201, 429])
  })
})

describe('admin feedback', () => {
  const admin = () => db.mockResolvedValueOnce({ rows: [{}] } as any)
  beforeEach(() => { db.mockReset() })

  it('lists feedback with the sender, open items first', async () => {
    admin()
    db.mockResolvedValueOnce({ rows: [{ id: 2, kind: 'bug', status: 'open', username: 'reader' }] } as any)
    const response = await request(app).get('/api/admin/feedback')
    expect(response.status).toBe(200)
    expect(response.body.data[0]).toMatchObject({ id: 2, kind: 'bug' })
    expect(db.mock.calls[1][0]).toMatch(/ORDER BY \(f\.status = 'open'\) DESC, f\.created_at DESC/)
  })

  it('moves feedback between open, reviewed and resolved', async () => {
    for (const status of ['reviewed', 'resolved', 'open']) {
      admin(); db.mockResolvedValueOnce({ rows: [{ id: 2 }] } as any)
      const response = await request(app).patch('/api/admin/feedback/2').send({ status })
      expect(response.status).toBe(200)
    }
  })

  it('refuses an unknown status and an unknown id', async () => {
    admin()
    expect((await request(app).patch('/api/admin/feedback/2').send({ status: 'deleted' })).status).toBe(400)
    admin(); db.mockResolvedValueOnce({ rows: [] } as any)
    expect((await request(app).patch('/api/admin/feedback/999').send({ status: 'resolved' })).status).toBe(404)
  })

  it('counts open feedback in the overview', async () => {
    admin()
    db.mockResolvedValueOnce({ rows: [{ users: 1, open_feedback: 3 }] } as any).mockResolvedValue({ rows: [] } as any)
    await request(app).get('/api/admin/overview')
    expect(db.mock.calls[1][0]).toContain("FROM feedback WHERE status = 'open') AS open_feedback")
  })
})
