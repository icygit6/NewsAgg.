import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { clientIp, ipBucket } from './clientIp'
import { JWT_SECRET } from '../config'

const req = (headers: Record<string, string>, ip = '172.70.0.9') => ({ headers, ip }) as any

beforeEach(() => { process.env.NEWSAGG_EDGE_KEY = 'edge-secret' })
afterEach(() => { delete process.env.NEWSAGG_EDGE_KEY; vi.resetModules() })

it('trusts the visitor address only when the Worker vouches for it with the edge key', () => {
  expect(clientIp(req({ 'x-newsagg-client-ip': '203.0.113.7', 'x-newsagg-edge-key': 'edge-secret' }))).toBe('203.0.113.7')
  // A visitor setting the header themselves cannot pick their own bucket.
  expect(clientIp(req({ 'x-newsagg-client-ip': '203.0.113.7', 'x-newsagg-edge-key': 'guess' }))).toBe('172.70.0.9')
  expect(clientIp(req({ 'x-newsagg-client-ip': 'not-an-ip', 'x-newsagg-edge-key': 'edge-secret' }))).toBe('172.70.0.9')
  delete process.env.NEWSAGG_EDGE_KEY
  expect(clientIp(req({ 'x-newsagg-client-ip': '203.0.113.7', 'x-newsagg-edge-key': '' }))).toBe('172.70.0.9')
})

it('groups an IPv6 subscriber by /64 so changing the last bits does not reset a limit', () => {
  expect(ipBucket('2001:db8:1:2:aaaa::1')).toBe(ipBucket('2001:db8:1:2:bbbb:cccc:dddd:eeee'))
  expect(ipBucket('2001:db8:1:2::1')).not.toBe(ipBucket('2001:db8:1:3::1'))
  expect(ipBucket('::ffff:198.51.100.4')).toBe('ip:198.51.100.4')
  expect(ipBucket('198.51.100.4')).toBe('ip:198.51.100.4')
})

it('gives each visitor behind the Worker their own budget, and never meters the sign-in check', async () => {
  const { apiLimiter } = await import('../middleware/rateLimit')
  const app = express().set('trust proxy', 1).use(apiLimiter)
  app.get('/api/news', (_req, res) => { res.json({ ok: true }) })
  app.get('/api/account/me', (_req, res) => { res.json({ ok: true }) })
  const viaWorker = (ip: string) => ({ 'X-Forwarded-For': '2a06:98c0:3600::103', 'X-NewsAgg-Client-IP': ip, 'X-NewsAgg-Edge-Key': 'edge-secret' })

  const first = await request(app).get('/api/news').set(viaWorker('203.0.113.7'))
  const other = await request(app).get('/api/news').set(viaWorker('198.51.100.4'))
  expect(Number(first.headers['ratelimit-remaining'] ?? first.headers['x-ratelimit-remaining'])).toBe(599)
  expect(Number(other.headers['ratelimit-remaining'] ?? other.headers['x-ratelimit-remaining'])).toBe(599)

  const token = jwt.sign({ userId: 42, sessionId: 's' }, JWT_SECRET)
  const signedIn = await request(app).get('/api/news').set(viaWorker('203.0.113.7')).set('Cookie', `newsagg_session=${token}`)
  expect(Number(signedIn.headers['ratelimit-remaining'] ?? signedIn.headers['x-ratelimit-remaining'])).toBe(599)

  const me = await request(app).get('/api/account/me').set(viaWorker('203.0.113.7'))
  expect(me.headers['ratelimit-remaining'] ?? me.headers['x-ratelimit-remaining']).toBeUndefined()
})
