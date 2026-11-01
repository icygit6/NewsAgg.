import { beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
vi.mock('../db/client', () => ({ query: vi.fn() }))
import { query } from '../db/client'
import { newsRouter } from './news'
const db = vi.mocked(query)
const app = express().use('/news', newsRouter)
describe('feed quality contract', () => {
  beforeEach(() => { db.mockReset(); db.mockImplementation(async (sql) => ({rows:sql.includes('publication_state')?[{revision:'1'}]:[]} as any)) })
  it('excludes old and future stories even in oldest order', async () => {
    const result = await request(app).get('/news?sort=oldest&page=1&category=health')
    expect(result.status).toBe(200)
    const sql = db.mock.calls.find(([sql])=>!sql.includes('publication_state'))![0]
    expect(sql).toContain("interval '30 days'")
    expect(sql).toContain("NULLIF(btrim(a.url_to_image), '') IS NOT NULL")
    expect(sql).toContain("interval '2 hours'")
    expect(sql).toContain('a.feed_eligible = true')
    expect(sql).toContain("a.extraction_version = 'structured-v3'")
    expect(sql).toContain('jsonb_array_length(a.content_blocks) > 0')
    expect(sql).toContain('ASC')
    expect(sql).toContain('duplicate.content_hash = a.content_hash')
    expect(sql).toContain('duplicate.source_id = a.source_id')
    expect(sql).toContain('86400')
    // The headline normaliser must reach Postgres as \s+ (whitespace), not
    // "s+" — a single backslash is dropped inside a JS template literal.
    expect(sql).toContain("regexp_replace(btrim(duplicate.title), '\\s+', ' ', 'g')")
    // Hash and headline duplicates stay separate anti-joins (an OR between
    // them forced a 7-10 s nested loop over every article pair).
    expect(sql.match(/NOT EXISTS/g)?.length).toBeGreaterThanOrEqual(2)
  })
  it('filters freshness by publication rather than scrape time', async () => {
    await request(app).get('/news?sinceHours=24&page=1')
    const sql = db.mock.calls.find(([sql])=>!sql.includes('publication_state'))![0]
    expect(sql).toContain('a.published_at >= NOW() - ($1')
    expect(sql).not.toContain('COALESCE(a.scraped_at, a.published_at) >=')
  })
  it('diversifies top stories by topic and publisher without sentiment bias', async () => {
    await request(app).get('/news?sort=top&page=1')
    const sql = db.mock.calls.find(([sql])=>!sql.includes('publication_state'))![0]
    expect(sql).toContain('PARTITION BY topic, source_id')
    expect(sql).not.toContain('abs(COALESCE(sentiment_polarity')
  })
  it('keeps legacy feeds behind the same freshness gate', async () => {
    await request(app).get('/news?category=world')
    const sql = db.mock.calls.find(([sql])=>!sql.includes('publication_state'))![0]
    expect(sql).toContain('WHERE a.feed_eligible = true')
    expect(sql).toContain('AND LOWER(a.topic)')
  })
})
