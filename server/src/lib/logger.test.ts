import { Writable } from 'stream'
import express from 'express'
import pinoHttp from 'pino-http'
import request from 'supertest'
import { expect, it } from 'vitest'
import { pino } from 'pino'

it('request logs never contain session cookies, tokens or the edge key', async () => {
  const { LOG_REDACT } = await import('./logger')
  const lines: string[] = []
  const sink = new Writable({ write(chunk, _enc, done) { lines.push(String(chunk)); done() } })
  // The app logger's redaction rules, written to a buffer we can read.
  const captured = pino({ redact: LOG_REDACT }, sink)
  const app = express().use(pinoHttp({ logger: captured }))
  app.get('/api/account/me', (_req, res) => { res.cookie('newsagg_session', 'fresh-token').json({ ok: true }) })

  await request(app).get('/api/account/me')
    .set('Cookie', 'newsagg_session=live-session-token')
    .set('Authorization', 'Bearer live-bearer-token')
    .set('X-NewsAgg-Edge-Key', 'edge-secret')

  const out = lines.join('')
  expect(out).toContain('/api/account/me')
  for (const secret of ['live-session-token', 'live-bearer-token', 'edge-secret', 'fresh-token']) expect(out).not.toContain(secret)
  expect(out).toContain('[redacted]')
})
