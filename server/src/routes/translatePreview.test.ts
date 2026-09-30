import { beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../db/client', () => ({ query: vi.fn() }))
vi.mock('../lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))
vi.mock('../services/translate', () => ({
  SUPPORTED_LANGS: ['en', 'id', 'zh-CN', 'zh-TW'],
  TRANSLATION_PIPELINE_VERSION: 'v2-chunked',
  translateArticlePreviews: vi.fn(),
  translateArticleFields: vi.fn(),
  translationModelVersion: vi.fn(() => 'gemini:test:v2-chunked'),
}))

import { query } from '../db/client'
import { translateArticlePreviews } from '../services/translate'
import { previewSourceHash, translateRouter } from './translate'

const mockQuery = query as unknown as ReturnType<typeof vi.fn>
const mockTranslate = translateArticlePreviews as unknown as ReturnType<typeof vi.fn>

describe('preview translation cache', () => {
  beforeEach(() => vi.clearAllMocks())

  it('serves a matching PostgreSQL preview without consuming translation quota', async () => {
    const sourceHash = previewSourceHash({
      title: 'Judul', description: 'Deskripsi', ai_summary: 'Ringkasan', language: 'id',
    })
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM articles WHERE id')) return {
        rows: [{ id: 'article-1', title: 'Judul', description: 'Deskripsi', ai_summary: 'Ringkasan', language: 'id' }],
      }
      if (sql.includes('FROM article_preview_translations')) return {
        rows: [{
          article_id: 'article-1', title: 'Title', description: 'Description', ai_summary: 'Summary',
          source_hash: sourceHash, provider: 'gemini', model_version: 'gemini:test:v2-chunked',
        }],
      }
      return { rows: [] }
    })
    const app = express()
    app.use(express.json())
    app.use('/api/articles', translateRouter)

    const first = await request(app).post('/api/articles/translate-previews').send({ articleIds: ['article-1'], lang: 'en' })

    expect(first.status).toBe(200)
    expect(first.body.data[0]).toMatchObject({ id: 'article-1', title: 'Title', cached: true })
    expect(mockTranslate).not.toHaveBeenCalled()
  })
})
