// Optional free-tier stable front door. Quick Tunnel remains the backend.
// Set NEWSAGG_ORIGIN in Wrangler variables and update it when the tunnel changes.
export function tunnelOrigin(value) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || !/^[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com$/.test(u.hostname) || u.username || u.password || u.port || u.pathname !== '/' || u.search || u.hash) return null;
    return u.origin;
  } catch { return null; }
}

export default {
  async fetch(request, env) {
    const origin = tunnelOrigin(env.NEWSAGG_ORIGIN);
    if (!origin) return new Response('NewsAgg is not connected yet.', {status:503,headers:{'Cache-Control':'no-store'}});
    const publicUrl = new URL(request.url);
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
      return response;
    } catch {
      return new Response('NewsAgg is temporarily offline. Please try again shortly.', {status:503,headers:{'Cache-Control':'no-store','Retry-After':'30'}});
    }
  }
};
