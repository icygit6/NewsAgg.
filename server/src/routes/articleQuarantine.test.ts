import { beforeEach, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
vi.mock('../db/client', () => ({ query: vi.fn() }))
vi.mock('../lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))
vi.mock('../services/translate', () => ({ SUPPORTED_LANGS: ['en'], TRANSLATION_PIPELINE_VERSION: 'test', translateArticleFields: vi.fn(), translateArticlePreviews: vi.fn(), translationModelVersion: vi.fn() }))
import { query } from '../db/client'
import { articlesRouter } from './articles'
import { translateRouter } from './translate'
import { translateArticleFields } from '../services/translate'
const app=express();app.use(express.json());app.use('/api/articles',translateRouter);app.use('/api/articles',articlesRouter)
beforeEach(()=>{
 vi.clearAllMocks()
 vi.mocked(query).mockImplementation(async (sql: string)=>({rows: sql.includes('publication_state') ? [{revision: String(Math.random())}] : [], rowCount: 0} as any))
})
it('blocks a quarantined direct article and checks review status in SQL',async()=>{
 expect((await request(app).get('/api/articles/7c5610a228e46354')).status).toBe(404)
 expect(vi.mocked(query).mock.calls.some(([sql])=>sql.includes('WHERE a.id = $1')&&sql.includes('content_review_status'))).toBe(true)
})
it('blocks translation before consuming translation quota',async()=>{
 expect((await request(app).get('/api/articles/7c5610a228e46354/translate?lang=en')).status).toBe(404)
 expect(translateArticleFields).not.toHaveBeenCalled()
 expect(vi.mocked(query).mock.calls[0][0]).toContain('content_review_status')
})
