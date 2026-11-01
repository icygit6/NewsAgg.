// Optional free-tier stable front door. Quick Tunnel remains the backend.
// Set NEWSAGG_ORIGIN in Wrangler variables and update it when the tunnel changes.
export function tunnelOrigin(value) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || !/^[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com$/.test(u.hostname) || u.username || u.password || u.port || u.pathname !== '/' || u.search || u.hash) return null;
    return u.origin;
  } catch { return null; }
}

/** How long the edge may keep a public file, or 0 for "always ask the laptop". Hashed build
 * assets never change; other static files change rarely; the HTML shell is cached briefly so a
 * cold visit skips the tunnel round trip while a deploy still shows up within a minute. */
export function edgeTtl(pathname, accept = '') {
  if (/^\/(?:api|auth|admin|dbviewer|health)(?:\/|$)/.test(pathname)) return 0;
  if (pathname.startsWith('/assets/')) return 31536000;
  if (/\.(?:png|svg|ico|webp|jpe?g|woff2?|webmanifest|css)$/.test(pathname)) return 86400;
  if (pathname === '/' || (!/\.[a-z0-9]+$/i.test(pathname) && accept.includes('text/html'))) return 60;
  return 0;
}

/** Keep HTML route queries collapsed, but honour explicit static-asset versions.
 * The namespace also retires pre-versioning edge entries for old logo URLs. */
export function edgeCacheUrl(value) {
  const input = new URL(value);
  const key = new URL(input.origin + input.pathname);
  if (/\.(?:png|svg|ico|webp|jpe?g|woff2?|webmanifest|css)$/.test(input.pathname)) {
    key.searchParams.set('asset-revision', 'sentiment-20261022');
    const version = input.searchParams.get('v');
    if (version && /^[a-zA-Z0-9._-]{1,64}$/.test(version)) key.searchParams.set('v', version);
  }
  return key.href;
}

export const ROBOTS = 'User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /auth/\nDisallow: /admin\nDisallow: /dbviewer/\n';

export default {
  async fetch(request, env, ctx) {
    const publicUrl = new URL(request.url);
    // Served here so the file is exactly ours (valid directives only).
    if (publicUrl.pathname === '/robots.txt') return new Response(ROBOTS, {headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'public, max-age=3600'}});
    const origin = tunnelOrigin(env.NEWSAGG_ORIGIN);
    if (!origin) return new Response('NewsAgg is not connected yet.', {status:503,headers:{'Cache-Control':'no-store'}});
    const ttl = request.method === 'GET' && !request.headers.has('Authorization') ? edgeTtl(publicUrl.pathname, request.headers.get('Accept') || '') : 0;
    const cache = ttl && typeof caches !== 'undefined' ? caches.default : null;
    const cacheKey = cache ? new Request(edgeCacheUrl(publicUrl.href), {method:'GET'}) : null;
    if (cache) {
      const hit = await cache.match(cacheKey);
      if (hit) return hit;
    }
    // Construct from components, never accept a client-supplied upstream URL.
    const target = new URL(origin);
    target.pathname = publicUrl.pathname;
    target.search = publicUrl.search;
    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('x-forwarded-host');
    headers.delete('x-forwarded-for');
    headers.set('x-forwarded-proto', 'https');
    try {
      const upstream = await fetch(new Request(target, {method:request.method, headers, body:['GET','HEAD'].includes(request.method)?null:request.body, redirect:'manual'}));
      const response = new Response(upstream.body, upstream);
      const location = response.headers.get('Location');
      if (location) {
        const next = new URL(location, origin);
        if (next.origin === origin) response.headers.set('Location', `${publicUrl.origin}${next.pathname}${next.search}${next.hash}`);
      }
      // Quick Tunnels stamp every response "X-Robots-Tag: none", which hides
      // the public site from search engines. Drop it for reader pages; keep
      // private and machine paths out of the index explicitly.
      response.headers.delete('X-Robots-Tag');
      if (/^\/(?:api|auth|admin|dbviewer)(?:\/|$)/.test(publicUrl.pathname)) response.headers.set('X-Robots-Tag','noindex, nofollow');
      // Do not cache sessions, personalized responses, or authentication exchanges.
      if (publicUrl.pathname.startsWith('/auth/') || publicUrl.pathname.startsWith('/api/') || response.headers.has('Set-Cookie')) response.headers.set('Cache-Control','private, no-store');
      else if (cache && response.status === 200) {
        response.headers.set('Cache-Control', ttl >= 86400 ? `public, max-age=${ttl}${ttl === 31536000 ? ', immutable' : ''}` : `public, max-age=0, s-maxage=${ttl}, must-revalidate`);
        ctx?.waitUntil?.(cache.put(cacheKey, response.clone()));
      }
      return response;
    } catch {
      return new Response('NewsAgg is temporarily offline. Please try again shortly.', {status:503,headers:{'Cache-Control':'no-store','Retry-After':'30'}});
    }
  }
};
