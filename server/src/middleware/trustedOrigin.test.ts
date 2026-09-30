import { describe, expect, it } from 'vitest'
import express from 'express'
import request from 'supertest'
import { requireTrustedOrigin } from './trustedOrigin'

function app() {
  const instance = express()
  instance.use(requireTrustedOrigin)
  instance.post('/write', (_req, res) => res.json({ success: true }))
  return instance
}

describe('trusted browser origins', () => {
  it('rejects cross-site browser writes', async () => {
    const response = await request(app()).post('/write').set('Sec-Fetch-Site', 'cross-site')
    expect(response.status).toBe(403)
  })

  it('allows non-browser API clients without an Origin header', async () => {
    const response = await request(app()).post('/write')
    expect(response.status).toBe(200)
  })

  it('allows writes from the exact reverse-proxied origin', async () => {
    const response = await request(app())
      .post('/write')
      .set('Origin', 'https://news.example.test')
      .set('X-Forwarded-Proto', 'https')
      .set('X-Forwarded-Host', 'news.example.test')
    expect(response.status).toBe(200)
  })
})
