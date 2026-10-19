/** Recover the same Yahoo-hosted asset if its resize endpoint fails. */
export function yahooOriginalImage(src: string): string | null {
  try {
    const url = new URL(src);
    if (url.protocol !== 'https:' || url.hostname !== 's.yimg.com' || !url.pathname.startsWith('/lo/mysterio/api/')) return null;
    const encoded = url.pathname.slice(url.pathname.lastIndexOf('/') + 1);
    const original = new URL(decodeURIComponent(encoded));
    return original.protocol === 'https:' && original.hostname === 'media.zenfs.com' && !original.username && !original.password && !original.port
      ? original.href : null;
  } catch { return null; }
}

export function imageCandidates(src?: string, alternatives: string[] = []): string[] {
  return [...new Set([src, ...alternatives].filter((url): url is string => Boolean(url)).flatMap((url) => {
    const original = yahooOriginalImage(url);
    return original ? [url, original] : [url];
  }))];
}
