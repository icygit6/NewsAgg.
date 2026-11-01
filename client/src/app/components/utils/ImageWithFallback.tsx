import { useUiText } from '../../i18n/uiText';
import React, { useState } from 'react'
import { imageCandidates } from '../../lib/articleImages';
import { BrandLogo } from '../ui/BrandLogo';

export function ImageWithFallback(props: React.ImgHTMLAttributes<HTMLImageElement> & { fallbackSources?: string[] }) {
  const ui = useUiText();
  const { src, fallbackSources, alt, style, className, fetchPriority, onError, ...rest } = props
  const candidates = imageCandidates(src, fallbackSources);
  const identity = JSON.stringify(candidates);
  const [failures, setFailures] = useState<{ identity: string; urls: string[] }>({ identity, urls: [] });
  const failed = failures.identity === identity ? failures.urls : [];
  const activeSrc = candidates.find((url) => !failed.includes(url));
  const handleError: React.ReactEventHandler<HTMLImageElement> = (event) => {
    if (activeSrc) setFailures((previous) => ({ identity, urls: [...new Set([...(previous.identity === identity ? previous.urls : []), activeSrc])] }));
    onError?.(event);
  }
  // React 18 doesn't forward the camelCase `fetchPriority` prop to the DOM (that
  // landed in React 19). Emit the lowercase `fetchpriority` attribute the browser
  // actually reads, so the LCP hint lands and the "unrecognized prop" warning goes.
  const priorityAttr: Record<string, string | undefined> = fetchPriority
    ? { fetchpriority: fetchPriority }
    : {}

  return !activeSrc ? (
    // Some stories have no photo at the publisher (Yahoo text pieces, for
    // instance); show a calm branded card rather than a broken-image icon.
    <div
      role="img"
      aria-label={ui("No photo from the publisher")}
      className={`@container relative inline-block overflow-hidden align-middle ${/\bh-auto\b/.test(className ?? '') ? 'aspect-[16/9]' : ''} ${className ?? ''}`}
      style={{ background: 'var(--color-blue-800)', ...style }}
      data-original-url={src}
    >
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-2 text-white/80">
        <span aria-hidden="true" className="grid aspect-square w-[28%] min-w-9 max-w-16 place-items-center rounded-xl bg-white/95 p-1.5 shadow-sm"><BrandLogo showWordmark={false} markClassName="h-full w-full" onLight /></span>
        <span className="hidden text-xs font-medium @[11rem]:block">{ui("No photo from the publisher")}</span>
      </div>
    </div>
  ) : (
    <img
      key={activeSrc}
      src={activeSrc}
      alt={alt}
      className={className}
      style={style}
      {...priorityAttr}
      {...rest}
      referrerPolicy={props.referrerPolicy ?? 'no-referrer'}
      onError={handleError}
    />
  )
}
