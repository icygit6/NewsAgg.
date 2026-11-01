import { useState } from 'react';
import { SOURCES, matchSourceId, sourceLogoUrl } from '../../constants';

interface SourceLogoProps {
  source: { id?: string | null; name: string; domain?: string | null; logo?: string | null };
  isDark: boolean;
  className?: string;
}

/**
 * Publisher logo with graceful fallbacks. Some publishers refuse hotlinked
 * favicons (CNN's own /favicon.ico returns an error to other origins), so a
 * failed logo falls back to the favicon service, then to a monogram — never
 * to the browser's broken-image glyph.
 */
export function SourceLogo({ source, isDark, className = 'h-9 w-9' }: SourceLogoProps) {
  const knownId = matchSourceId(source);
  const knownDomain = SOURCES.find((option) => option.id === knownId)?.domain;
  // The four publishers' icons are served from /source-logos/, so the page
  // doesn't depend on (or log errors from) their own sites.
  const candidates = [knownId ? `/source-logos/${knownId}.png` : null, source.logo, knownDomain || source.domain ? sourceLogoUrl(knownDomain || source.domain || '') : null]
    .filter((url, index, all): url is string => Boolean(url) && all.indexOf(url) === index);
  const [attempt, setAttempt] = useState(0);
  const src = candidates[attempt];

  if (!src) {
    return (
      <div
        aria-hidden="true"
        className={`${className} rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200`}
      >
        {source.name.slice(0, 1)}
      </div>
    );
  }
  return (
    <img
      key={src}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setAttempt((value) => value + 1)}
      // Publisher marks are drawn for light backgrounds (BBC's is black on
      // transparent), so they keep a white disc in dark mode too.
      className={`${className} rounded-full object-cover flex-shrink-0 bg-white border ${isDark ? 'border-slate-700' : 'border-slate-100'}`}
    />
  );
}
