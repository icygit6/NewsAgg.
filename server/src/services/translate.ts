import { GoogleGenAI } from '@google/genai'
import { logger } from '../lib/logger'

// Server-side translation service. Gemini Flash-Lite is the primary provider;
// Lingva (no API key) is the fallback. GEMINI_API_KEY is read from the server
// env only — it is never sent to the client (see CLAUDE.md secret rules).
const GEMINI_MODEL = process.env.GEMINI_TRANSLATE_MODEL || 'gemini-3.5-flash-lite'

function gemini(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')
  return new GoogleGenAI({ apiKey, httpOptions: { timeout: 20_000 } })
}

export type ApiLang = 'en' | 'id' | 'zh-CN' | 'zh-TW'
export const SUPPORTED_LANGS: ApiLang[] = ['en', 'id', 'zh-CN', 'zh-TW']

// Human-readable names used in the Gemini prompt.
const LANG_NAMES: Record<ApiLang, string> = {
  en: 'English',
  id: 'Indonesian (Bahasa Indonesia)',
  'zh-CN': 'Simplified Chinese (简体中文)',
  'zh-TW': 'Traditional Chinese (繁體中文)',
}

// Lingva uses Google-Translate-style codes; Traditional Chinese is zh_HANT.
const LINGVA_CODE: Record<ApiLang, string> = {
  en: 'en',
  id: 'id',
  'zh-CN': 'zh',
  'zh-TW': 'zh_HANT',
}

export interface TranslatableFields {
  title: string | null
  description: string | null
  content: string | null
  aiSummary: string | null
}

export type TranslationProvider = 'gemini' | 'lingva' | 'none'

export interface TranslationResult extends TranslatableFields {
  provider: TranslationProvider
}

export interface PreviewTranslation extends Omit<TranslatableFields, 'content'> {
  id: string
}

const FIELD_KEYS = ['title', 'description', 'content', 'aiSummary'] as const

const hasText = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.trim().length > 0

// ─── Gemini (primary) ─────────────────────────────────────────────────────────

async function translateWithGemini(
  fields: TranslatableFields,
  targetLang: ApiLang
): Promise<TranslatableFields> {
  const payload: Record<string, string> = {}
  for (const key of FIELD_KEYS) {
    if (hasText(fields[key])) payload[key] = fields[key] as string
  }
  // Nothing translatable — return originals unchanged.
  if (Object.keys(payload).length === 0) return { ...fields }

  const prompt = `Translate the VALUES of the following JSON object into ${LANG_NAMES[targetLang]}.
Keep the exact same keys. Translate faithfully and naturally; do not summarise, omit, or add commentary.
Preserve line breaks within values. Return ONLY a valid JSON object with the same keys.
JSON:
${JSON.stringify(payload)}`

  const result = await gemini().models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      temperature: 0.2,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
  })

  const parsed = JSON.parse((result.text || '').trim()) as Record<string, unknown>
  const out: TranslatableFields = { title: null, description: null, content: null, aiSummary: null }
  for (const key of FIELD_KEYS) {
    if (!hasText(fields[key])) {
      out[key] = fields[key]
      continue
    }
    const value = parsed[key]
    out[key] = hasText(value as string) ? (value as string) : fields[key]
  }
  return out
}

// ─── Lingva (fallback) ──────────────────────────────────────────────────────

async function lingvaField(text: string, target: string): Promise<string | null> {
  // 'auto' source lets Lingva detect the article's language.
  const url = `https://lingva.ml/api/v1/auto/${target}/${encodeURIComponent(text)}`
  // Timeout: a hung upstream must fail the request, not hold it open forever.
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`Lingva HTTP ${res.status}`)
  const data = (await res.json()) as { translation?: string }
  return hasText(data.translation) ? (data.translation as string) : null
}

async function translateWithLingva(
  fields: TranslatableFields,
  targetLang: ApiLang
): Promise<TranslatableFields> {
  const target = LINGVA_CODE[targetLang]
  const out: TranslatableFields = { title: null, description: null, content: null, aiSummary: null }
  let attempted = 0
  let translated = 0
  for (const key of FIELD_KEYS) {
    const original = fields[key]
    if (!hasText(original)) {
      out[key] = original
      continue
    }
    attempted++
    try {
      const result = await lingvaField(original, target)
      if (result !== null) translated++
      out[key] = result ?? original
    } catch {
      // One field failing must not drop the rest — keep the original.
      out[key] = original
    }
  }
  // Nothing actually translated → fail loudly so the caller reports
  // provider 'none' and the route does NOT cache the originals as a
  // translation (which would poison the translations table permanently).
  if (attempted > 0 && translated === 0) {
    throw new Error('Lingva translated no fields')
  }
  return out
}

// ─── Public entry point ─────────────────────────────────────────────────────

/**
 * Translate an article's fields into `targetLang`. Tries Gemini first, falls
 * back to Lingva, and on total failure returns the originals with provider
 * 'none' (so the caller can avoid caching a non-translation).
 */
export async function translateArticleFields(
  fields: TranslatableFields,
  targetLang: ApiLang
): Promise<TranslationResult> {
  if (process.env.GEMINI_API_KEY) {
    try {
      const g = await translateWithGemini(fields, targetLang)
      return { ...g, provider: 'gemini' }
    } catch (err) {
      logger.error({ err: (err as Error).message }, '[translate] Gemini failed, falling back to Lingva:')
    }
  }

  try {
    const l = await translateWithLingva(fields, targetLang)
    return { ...l, provider: 'lingva' }
  } catch (err) {
    logger.error({ err: (err as Error).message }, '[translate] Lingva failed:')
  }

  return { ...fields, provider: 'none' }
}

/** Translate a feed page in one model call. Preview translations are intentionally
 * not persisted in the full-article cache because they do not contain content. */
export async function translateArticlePreviews(
  records: PreviewTranslation[],
  targetLang: ApiLang
): Promise<Array<PreviewTranslation & { provider: TranslationProvider }>> {
  if (records.length === 0) return []
  if (!process.env.GEMINI_API_KEY) return records.map((record) => ({ ...record, provider: 'none' }))

  const prompt = `Translate the text values in this JSON array into ${LANG_NAMES[targetLang]}.
Keep every id and key exactly as supplied. Do not summarize. Return ONLY a valid JSON array.
JSON:
${JSON.stringify(records)}`
  try {
    const result = await gemini().models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: { temperature: 0.2, maxOutputTokens: 8192, responseMimeType: 'application/json' },
    })
    const parsed = JSON.parse((result.text || '').trim()) as PreviewTranslation[]
    const byId = new Map(parsed.map((item) => [String(item.id), item]))
    return records.map((original) => {
      const translated = byId.get(original.id)
      return translated
        ? { ...original, ...translated, id: original.id, provider: 'gemini' as const }
        : { ...original, provider: 'none' as const }
    })
  } catch (err) {
    logger.error({ err: (err as Error).message }, '[translate] preview batch failed:')
    return records.map((record) => ({ ...record, provider: 'none' }))
  }
}
