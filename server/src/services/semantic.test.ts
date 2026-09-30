import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules() })

describe('hybrid retrieval', () => {
  it('keeps lexical fallback bounded and in article order', async () => {
    vi.stubEnv('LOCAL_AI_URL', '')
    const { hybridPassages } = await import('./semantic')
    expect(await hybridPassages(['a', 'b', 'c', 'd', 'e'], 'question', ['e', 'a', 'd', 'b', 'c'], 2)).toEqual(['a', 'e'])
  })
  it('allows semantic evidence beyond the lexical top four to be selected', async () => {
    vi.stubEnv('LOCAL_AI_URL', 'http://local-ai:8090')
    const vector = (score: number) => [score, ...Array(1023).fill(0)]
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ embeddings: [0, .1, .2, .3, 1, .4].map(vector) }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ embeddings: [vector(1)] }) }))
    const { hybridPassages } = await import('./semantic')
    const chunks = ['a', 'b', 'c', 'd', 'e', 'f']
    expect(await hybridPassages(chunks, 'question', chunks, 4)).toContain('e')
  })
  it('falls back on invalid model dimensions', async () => {
    vi.stubEnv('LOCAL_AI_URL', 'http://local-ai:8090')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ embeddings: [[1]] }) }))
    const { hybridPassages } = await import('./semantic')
    expect(await hybridPassages(['a', 'b', 'c'], 'question', ['c', 'b', 'a'], 1)).toEqual(['c'])
  })
})
