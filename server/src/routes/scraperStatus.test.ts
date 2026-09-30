import { describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
vi.mock('../db/client', () => ({ query:vi.fn() }))
import { query } from '../db/client'
import { statsRouter } from './stats'
const app = express().use('/stats',statsRouter)

describe('scraper status', () => {
  it('reports partial quotas without exposing unexpected report fields', async () => {
    vi.mocked(query).mockResolvedValueOnce({rows:[{started_at:'2026-09-20',finished_at:null,status:'partial',report:{inserted:12,errors:0,deficit_bbc_Climate:2,private_error:'hidden',key:'hidden'}}]} as any)
    const r=await request(app).get('/stats/scraper-status')
    expect(r.status).toBe(200)
    expect(r.headers['cache-control']).toBe('no-store')
    expect(r.body.data.counts).toEqual({inserted:12,errors:0,deficit_bbc_Climate:2})
    expect(r.body.data.status).toBe('partial')
  })
  it('reports missing history honestly', async () => {
    vi.mocked(query).mockResolvedValueOnce({rows:[]} as any)
    expect((await request(app).get('/stats/scraper-status')).body.data).toBeNull()
  })
})
