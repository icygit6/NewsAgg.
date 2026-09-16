import { GoogleGenAI } from '@google/genai'
import { logger } from '../lib/logger'

export const GEMINI_MODEL = process.env.GEMINI_TRANSLATE_MODEL || 'gemini-3.5-flash-lite'
export const TRANSLATION_PIPELINE_VERSION = 'v2-chunked'
const MAX_GEMINI_CHARS = 5_000
const MAX_LINGVA_CHARS = 1_200

function gemini(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')
  return new GoogleGenAI({ apiKey, httpOptions: { timeout: 30_000 } })
}

export type ApiLang = 'en' | 'id' | 'zh-CN' | 'zh-TW'
export const SUPPORTED_LANGS: ApiLang[] = ['en', 'id', 'zh-CN', 'zh-TW']

const LANG_NAMES: Record<ApiLang, string> = {
  en: 'English',
  id: 'Indonesian (Bahasa Indonesia)',
  'zh-CN': 'Simplified Chinese (简体中文)',
  'zh-TW': 'Traditional Chinese (繁體中文)',
}

const LINGVA_CODE: Record<ApiLang, string> = {
  en: 'en', id: 'id', 'zh-CN': 'zh', 'zh-TW': 'zh_HANT',
}

export interface TranslatableFields {
  title: string | null
  description: string | null
  content: string | null
  aiSummary: string | null
}

export type TranslationProvider = 'gemini' | 'lingva' | 'none'
export interface TranslationResult extends TranslatableFields { provider: TranslationProvider }
export interface PreviewTranslation extends Omit<TranslatableFields, 'content'> { id: string }

const FIELD_KEYS = ['title', 'description', 'content', 'aiSummary'] as const
const hasText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

/** Paragraph-aware chunking keeps long articles inside provider limits and
 * avoids silently translating only the first part of a story. */
export function splitTranslationText(text: string, maxChars = MAX_GEMINI_CHARS): string[] {
  const paragraphs = text.replace(/\r/g, '').split(/\n{2,}/)
  const chunks: string[] = []
  let current = ''
  const flush = () => {
    if (current.trim()) chunks.push(current.trim())
    current = ''
  }
  for (const raw of paragraphs) {
    const paragraph = raw.trim()
    if (!paragraph) continue
    if (paragraph.length > maxChars) {
      flush()
      for (let offset = 0; offset < paragraph.length; offset += maxChars) {
        chunks.push(paragraph.slice(offset, offset + maxChars).trim())
      }
    } else if (current.length + paragraph.length + 2 > maxChars) {
      flush()
      current = paragraph
    } else {
      current += `${current ? '\n\n' : ''}${paragraph}`
    }
  }
  flush()
  return chunks
}

async function geminiText(text: string, targetLang: ApiLang): Promise<string> {
  const result = await gemini().models.generateContent({
    model: GEMINI_MODEL,
    contents: `Translate the following news text into ${LANG_NAMES[targetLang]}.
Translate faithfully and naturally. Preserve names, numbers, meaning, and paragraph breaks.
Do not summarize, explain, or add commentary. Return only the translated text.

${text}`,
    config: { temperature: 0.1, maxOutputTokens: 8192 },
  })
  const translated = result.text?.trim()
  if (!translated) throw new Error('Gemini returned an empty translation')
  return translated
}

async function translateWithGemini(fields: TranslatableFields, targetLang: ApiLang) {
  const out: TranslatableFields = { title: null, description: null, content: null, aiSummary: null }
  for (const key of FIELD_KEYS) {
    const original = fields[key]
    if (!hasText(original)) {
      out[key] = original
      continue
    }
    const chunks = splitTranslationText(original)
    const translated: string[] = []
    for (const chunk of chunks) translated.push(await geminiText(chunk, targetLang))
    if (translated.length !== chunks.length) throw new Error(`Incomplete translation for ${key}`)
    out[key] = translated.join('\n\n')
  }
  return out
}

async function lingvaField(text: string, target: string): Promise<string> {
  if (text.length > MAX_LINGVA_CHARS) {
    throw new Error('Text is too long for the URL-based Lingva fallback')
  }
  const url = `https://lingva.ml/api/v1/auto/${target}/${encodeURIComponent(text)}`
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`Lingva HTTP ${res.status}`)
  const data = (await res.json()) as { translation?: string }
  if (!hasText(data.translation)) throw new Error('Lingva returned an empty translation')
  return data.translation
}

async function translateWithLingva(fields: TranslatableFields, targetLang: ApiLang) {
  const out: TranslatableFields = { title: null, description: null, content: null, aiSummary: null }
  const populated = FIELD_KEYS.filter((key) => hasText(fields[key]))
  // Lingva transports text inside a URL. It is acceptable as a best-effort
  // fallback for short preview fields, not for full article bodies.
  if (populated.some((key) => (fields[key]?.length ?? 0) > MAX_LINGVA_CHARS)) {
    throw new Error('Lingva fallback disabled for long article text')
  }
  for (const key of FIELD_KEYS) {
    const original = fields[key]
    out[key] = hasText(original) ? await lingvaField(original, LINGVA_CODE[targetLang]) : original
  }
  return out
}

export async function translateArticleFields(
  fields: TranslatableFields,
  targetLang: ApiLang
): Promise<TranslationResult> {
  if (process.env.GEMINI_API_KEY) {
    try {
      return { ...(await translateWithGemini(fields, targetLang)), provider: 'gemini' }
    } catch (err) {
      logger.warn({ err: (err as Error).message }, '[translate] Gemini failed; trying short-text fallback')
    }
  }
  try {
    return { ...(await translateWithLingva(fields, targetLang)), provider: 'lingva' }
  } catch (err) {
    logger.warn({ err: (err as Error).message }, '[translate] no translation provider succeeded')
    return { ...fields, provider: 'none' }
  }
}

export async function translateArticlePreviews(
  records: PreviewTranslation[],
  targetLang: ApiLang
): Promise<Array<PreviewTranslation & { provider: TranslationProvider }>> {
  if (records.length === 0) return []
  if (process.env.GEMINI_API_KEY) {
    const prompt = `Translate the text values in this JSON array into ${LANG_NAMES[targetLang]}.
Keep every id and key exactly as supplied. Do not summarize. Return only a valid JSON array.
JSON:
${JSON.stringify(records)}`
    try {
      const result = await gemini().models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: { temperature: 0.1, maxOutputTokens: 8192, responseMimeType: 'application/json' },
      })
      const parsed = JSON.parse((result.text || '').trim()) as PreviewTranslation[]
      if (!Array.isArray(parsed) || parsed.length !== records.length) {
        throw new Error('Gemini preview response count mismatch')
      }
      const byId = new Map(parsed.map((item) => [String(item.id), item]))
      return records.map((original) => {
        const item = byId.get(original.id)
        if (!item || !hasText(item.title)) return { ...original, provider: 'none' as const }
        return { ...original, ...item, id: original.id, provider: 'gemini' as const }
      })
    } catch (err) {
      logger.warn({ err: (err as Error).message }, '[translate] preview batch failed; trying Lingva')
    }
  }
  return Promise.all(
    records.map(async (record) => {
      const translated = await translateArticleFields({ ...record, content: null }, targetLang)
      const { content: _content, ...preview } = translated
      return { ...record, ...preview }
    })
  )
}

export function translationModelVersion(provider: TranslationProvider): string {
  return provider === 'gemini'
    ? `${GEMINI_MODEL}:${TRANSLATION_PIPELINE_VERSION}`
    : `${provider}:${TRANSLATION_PIPELINE_VERSION}`
}
