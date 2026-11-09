import { timingSafeEqual } from 'crypto'
import { isIP } from 'net'
import type { Request } from 'express'

// Public traffic reaches the API through the Cloudflare Worker, and Cloudflare
// stamps the Worker's own address on that hop, so req.ip is the same for every
// visitor. The Worker therefore sends the visitor's address in
// X-NewsAgg-Client-IP alongside a shared secret (NEWSAGG_EDGE_KEY). The header
// is trusted only with the right secret; anyone else could set it to dodge or
// frame a rate limit.

function sameSecret(given: string, expected: string) {
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** The visitor's IP address: the Worker's vouched-for header, else the proxy-reported peer. */
export function clientIp(req: Request): string {
  const key = process.env.NEWSAGG_EDGE_KEY || ''
  const given = req.headers['x-newsagg-edge-key']
  const vouched = req.headers['x-newsagg-client-ip']
  if (key && typeof given === 'string' && typeof vouched === 'string' && sameSecret(given, key) && isIP(vouched)) {
    return vouched
  }
  return req.ip || req.socket?.remoteAddress || 'unknown'
}

/** Rate-limit key for an address. One IPv6 subscriber holds a whole /64, so
 * keying single IPv6 addresses would let them step around any limit. */
export function ipBucket(ip: string): string {
  const mapped = ip.startsWith('::ffff:') ? ip.slice(7) : ip
  if (isIP(mapped) !== 6) return `ip:${mapped}`
  const [head, tail = ''] = mapped.split('::')
  const left = head ? head.split(':') : []
  const right = tail ? tail.split(':') : []
  const groups = mapped.includes('::') ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right] : left
  return `ip6:${groups.slice(0, 4).map((g) => g.toLowerCase().replace(/^0+(?=.)/, '')).join(':')}::/64`
}
