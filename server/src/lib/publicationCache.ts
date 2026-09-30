import { query } from '../db/client'
import { TtlCache } from './ttlCache'

// A tiny revision query on each request avoids re-downloading full articles
// while making a committed publication visible on the next refresh.
export class PublicationCache<T> extends TtlCache<T> {
  private revision: string | null = null
  async wrap(key: string, loader: () => Promise<T>): Promise<T> {
    const result = await query('SELECT revision::text FROM public.publication_state WHERE singleton=true')
    const revision = result.rows[0]?.revision
    if (typeof revision !== 'string') throw new Error('Publication state unavailable')
    if (revision !== this.revision) {
      this.clear()
      this.revision = revision
    }
    return super.wrap(`${revision}:${key}`, loader)
  }
  delete(_key: string): void { this.clear() }
}
