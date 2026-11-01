import { useUiText } from '../../i18n/uiText';
import { useState } from 'react';
import { Play, ExternalLink } from 'lucide-react';

interface VideoPlayerProps {
  videoUrl: string;
  title: string;
  isDark: boolean;
}

export function getVideoEmbedUrl(url: string): string | null {
  if (!url) return null;

  // YouTube
  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
  if (youtubeMatch) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}?rel=0&modestbranding=1`;
  }

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  // CNN and BBC videos are NOT embeddable - they're article pages with players
  // Return null to fall back to external link
  return null;
}

export function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com|youtu\.be)/.test(url);
}

export function isVimeoUrl(url: string): boolean {
  return /vimeo\.com/.test(url);
}

export function isExternalVideoUrl(url: string): boolean {
  // CNN, BBC, and other news sites' video pages aren't embeddable
  return /(?:cnn\.com|bbc\.com)/.test(url);
}

export function VideoPlayer({ videoUrl, title }: VideoPlayerProps) {
  const ui = useUiText();
  const [isLoading, setIsLoading] = useState(true);

  if (!videoUrl) return null;

  const embedUrl = getVideoEmbedUrl(videoUrl);
  const isYouTube = isYouTubeUrl(videoUrl);
  const isVimeo = isVimeoUrl(videoUrl);
  const isExternal = isExternalVideoUrl(videoUrl);

  // If it's an external video page (CNN, BBC, etc.), show as external link
  if (isExternal) {
    return (
      <div className={`rounded-2xl overflow-hidden border mb-6 flex items-center gap-4 p-4 border-slate-100 bg-white/70 dark:border-slate-700/50 dark:bg-slate-800/60`}>
        <Play size={32} className="text-slate-400 dark:text-slate-400" />
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300`}>{ui("Featured Video")} </p>
          <p className={`text-sm line-clamp-2 mb-3 text-slate-600 dark:text-slate-400`}>
            {title}
          </p>
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600`}
          >
            <ExternalLink size={14} />{ui("Watch on source")} </a>
        </div>
      </div>
    );
  }

  // Embeddable videos (YouTube, Vimeo)
  if (!embedUrl) {
    return null;
  }

  return (
    <div
      className={`rounded-2xl overflow-hidden border mb-6 border-slate-100 bg-white/70 dark:border-slate-700/50 dark:bg-slate-800/60`}
    >
      <div className="relative w-full bg-black">
        {/* Aspect ratio container */}
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2">
                <Play size={40} className="text-white animate-pulse" />
                <p className="text-white text-xs">{ui("Loading video...")}</p>
              </div>
            </div>
          )}

          {(isYouTube || isVimeo) && embedUrl && (
            <iframe
              src={embedUrl}
              title={title}
              className="absolute inset-0 w-full h-full"
              allowFullScreen
              loading="lazy"
              onLoad={() => setIsLoading(false)}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          )}
        </div>
      </div>

      {/* Video info */}
      <div className={`px-4 py-3 bg-white/50 dark:bg-slate-800/40`}>
        <p className={`text-xs font-semibold text-slate-700 dark:text-slate-300`}>{ui("Featured Video")} </p>
        <p className={`text-sm line-clamp-2 text-slate-600 dark:text-slate-400`}>
          {title}
        </p>
      </div>
    </div>
  );
}
