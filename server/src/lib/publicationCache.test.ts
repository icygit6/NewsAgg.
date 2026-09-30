import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('../db/client',()=>({query:vi.fn()}))
import { query } from '../db/client'
import { PublicationCache } from './publicationCache'
describe('publication-aware caching',()=>{
  beforeEach(()=>vi.mocked(query).mockReset())
  it('reuses data only while the publication revision is unchanged',async()=>{
    const cache=new PublicationCache<number>(60000)
    const loader=vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2)
    vi.mocked(query).mockResolvedValue({rows:[{revision:'4'}]} as any)
    expect(await cache.wrap('feed',loader)).toBe(1)
    expect(await cache.wrap('feed',loader)).toBe(1)
    vi.mocked(query).mockResolvedValue({rows:[{revision:'5'}]} as any)
    expect(await cache.wrap('feed',loader)).toBe(2)
    expect(loader).toHaveBeenCalledTimes(2)
  })
  it('does not serve a stale cached feed if revision verification fails',async()=>{
    const cache=new PublicationCache<number>(60000)
    vi.mocked(query).mockResolvedValue({rows:[]} as any)
    await expect(cache.wrap('feed',async()=>1)).rejects.toThrow('Publication state unavailable')
  })
})
