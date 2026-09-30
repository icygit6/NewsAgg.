import { createHash } from 'node:crypto'
import { TtlCache } from '../lib/ttlCache'

const vectors = new TtlCache<number[][]>(60 * 60 * 1000, 30)
let retryAfter = 0

export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  const endpoint = process.env.LOCAL_AI_URL
  if (!endpoint || Date.now() < retryAfter || !texts.length || texts.length > 160) return null
  const key = createHash('sha256').update(JSON.stringify(texts)).digest('hex')
  try {
    return await vectors.wrap(key, async () => {
      const response = await fetch(`${endpoint}/embed`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texts }), signal: AbortSignal.timeout(12_000) })
      if (!response.ok) throw new Error('embedding_unavailable')
      const data = await response.json() as { embeddings?: number[][] }
      if (!Array.isArray(data.embeddings) || data.embeddings.length !== texts.length || data.embeddings.some(v => !Array.isArray(v) || v.length !== 1024 || v.some(x => !Number.isFinite(x)))) throw new Error('invalid_embedding')
      return data.embeddings
    })
  } catch {
    retryAfter = Date.now() + 30_000
    return null
  }
}

export async function hybridPassages(chunks: string[], question: string, lexical: string[], limit = 4): Promise<string[]> {
  if (chunks.length <= limit) return chunks
  const fallback = () => {
    const selected = new Set(lexical.slice(0, limit))
    return chunks.filter(chunk => selected.has(chunk)).slice(0, limit)
  }
  const document = await embedTexts(chunks)
  if (!document) return fallback()
  const query = await embedTexts([question])
  if (!query) return fallback()
  const semantic = chunks.map((chunk, index) => ({ chunk, score: document[index].reduce((s, v, i) => s + v * query[0][i], 0) })).sort((a,b) => b.score-a.score)
  // Reciprocal-rank fusion avoids mixing unrelated lexical/cosine scales.
  return chunks.map((chunk, index) => ({chunk, index, score: 1/(60 + semantic.findIndex(s => s.chunk === chunk)+1) + 1/(60 + (lexical.includes(chunk) ? lexical.indexOf(chunk) : chunks.length)+1)}))
    .sort((a,b) => b.score-a.score || a.index-b.index).slice(0,limit).sort((a,b) => a.index-b.index).map(x => x.chunk)
}
