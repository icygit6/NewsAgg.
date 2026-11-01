import { HERO_HEIGHT, HeroSkeleton } from './ui/ContentSkeleton';
import { useUiText } from '../i18n/uiText';
import { useTitleTranslations } from '../hooks/useTitleTranslations';
import { useState, useEffect, useRef, type PointerEvent } from 'react';
import { Link } from 'react-router';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ChevronLeft, ChevronRight, Clock3, TrendingUp } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { TOPIC_BADGE_CLASS } from '../constants';
import { getArticleId } from '../services/newsAPI';
import { useRankedHeadlines } from '../hooks/useArticles';
import { ImageWithFallback } from './utils/ImageWithFallback';
import { formatNewsDate } from '../lib/formatDate';
import type { SentimentType } from '../types/sentiment';

interface SentimentBadgeProps {
  sentiment: SentimentType;
}

function SentimentBadge({ sentiment }: SentimentBadgeProps) {
  const { t } = useApp();
  const colors = {
    positive: 'bg-emerald-500/90 text-white',
    neutral: 'bg-amber-400/95 text-amber-950',
    negative: 'bg-red-500/90 text-white',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${colors[sentiment as keyof typeof colors]}`}>
      {t[sentiment]}
    </span>
  );
}

/** A horizontal drag counts as a swipe past this many pixels. */
const SWIPE_PX = 48;

export function HeroCarousel() {
  const ui = useUiText();
  const { t, isDark, language, selectedCategory, selectedSources, selectedSentiment } = useApp();
  const shouldReduceMotion = useReducedMotion();
  const [current, setCurrent] = useState(0);
  // Autoplay pauses while a mouse hovers or keyboard focus is inside, and while the tab is hidden.
  const [paused, setPaused] = useState(false);
  const [tabHidden, setTabHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  // Importance-ranked headlines over the SAME filter set as the feed:
  // 'all' blends every category; any active filter narrows the carousel too.
  const { data, isLoading } = useRankedHeadlines({
    limit: 10,
    category: selectedCategory,
    sources: selectedSources,
    sentiment: selectedSentiment,
  });
  const headlines = useTitleTranslations(data?.articles ?? []);

  // Restart from the first slide whenever the filtered set changes.
  useEffect(() => setCurrent(0), [data]);

  useEffect(() => {
    const onVisibility = () => setTabHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Clamp: a filter change can shrink the list before the reset effect runs.
  const count = headlines.length;
  const idx = count ? current % count : 0;

  // Fetch the next slide's photo ahead of the cross-fade, so the transition never waits on the
  // network: that wait was the other reason the carousel felt uneven from slide to slide.
  const upcoming = count > 1 ? headlines[(idx + 1) % count] : undefined;
  const upcomingUrl = upcoming?.urlToImage || upcoming?.images[0]?.url;
  useEffect(() => {
    if (!upcomingUrl) return;
    const preload = new Image();
    preload.referrerPolicy = 'no-referrer'; // same policy as the visible <img>, so the cache entry is shared
    preload.decoding = 'async';
    preload.src = upcomingUrl;
  }, [upcomingUrl]);

  const prev = () => setCurrent(p => (p - 1 + count) % count);
  const next = () => setCurrent(p => (p + 1) % count);

  if (isLoading) {
    return <div role="status" aria-label={t.loading}><span className="sr-only">{t.loading}</span><HeroSkeleton /></div>;
  }

  // Loaded but no match for the active filters — the feed's own empty state covers it.
  if (count === 0) return null;

  const article = headlines[idx];
  const topicClass = TOPIC_BADGE_CLASS[article.topic];
  const autoplay = count > 1 && !shouldReduceMotion;

  const onPointerDown = (event: PointerEvent) => {
    swipe.current = { x: event.clientX, y: event.clientY };
    swiped.current = false;
  };
  const onPointerUp = (event: PointerEvent) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start || count < 2) return;
    const dx = event.clientX - start.x;
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(event.clientY - start.y) * 1.5) {
      swiped.current = true; // the click that follows a swipe must not open the article
      (dx < 0 ? next : prev)();
    }
  };
  // Hover pauses for a mouse only: on a touch screen "hover" sticks after a tap and would stop autoplay for good.
  const onPointerEnter = (event: PointerEvent) => { if (event.pointerType === 'mouse') setPaused(true); };
  const onPointerLeave = (event: PointerEvent) => { if (event.pointerType === 'mouse') setPaused(false); };

  return (
    <div
      className={`${HERO_HEIGHT} relative overflow-hidden transition-[border-color,box-shadow] duration-200 ease-out rounded-2xl border shadow-lg`}
      style={{
        overflowAnchor: 'none',
        touchAction: 'pan-y', // the page keeps vertical scrolling; horizontal drags are ours
        borderColor: isDark ? '#1e293b' : '#e2e8f0',
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
      }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { swipe.current = null; }}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}
      onClickCapture={(event) => {
        if (swiped.current) { event.preventDefault(); event.stopPropagation(); swiped.current = false; }
      }}
    >
      {/* Background images — initial={false} paints the first slide at full opacity
          (no fade-in) so the LCP image isn't held at opacity:0; later slides still cross-fade. */}
      <AnimatePresence initial={false}>
        <motion.div
          key={idx}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.35 }}
          className="absolute inset-0"
        >
          <ImageWithFallback
            src={article.urlToImage || article.images[0]?.url || undefined}
            fallbackSources={article.images.map((image) => image.url)}
            alt={article.title}
            className="w-full h-full object-cover"
            // Only the first slide is the LCP image; the rest are fetched ahead at normal priority.
            fetchPriority={idx === 0 ? 'high' : 'auto'}
            loading="eager"
            decoding="async"
            draggable={false}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent rounded-xl" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent rounded-xl" />
        </motion.div>
      </AnimatePresence>

      {/* Trending badge */}
      <div className="absolute top-3 left-4 flex items-center gap-2 z-10">
        <div className="flex items-center gap-1.5 bg-[#173a63] text-white px-2.5 py-1 rounded-md text-xs font-semibold shadow-sm">
          <TrendingUp size={10} />
          {t.topHeadlines}
        </div>
      </div>

      {/* Content. Full transform strings (not the x/y shorthands) so the slide-in is
          hardware-accelerated and keeps its pace while the page is busy. */}
      <AnimatePresence initial={false}>
        <motion.div
          key={`content-${idx}`}
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, transform: 'translateY(12px)' }}
          animate={{ opacity: 1, transform: 'translateY(0px)' }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, transform: 'translateY(-6px)' }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.3 }}
          className="absolute bottom-0 left-0 right-0 px-4 pt-4 pb-10 md:p-5 z-10"
        >
          <Link to={`/article/${getArticleId(article)}`} className="block group" draggable={false}>
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              <SentimentBadge sentiment={article.sentiment.type} />
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${topicClass}`}>{ui(article.topic)}</span>
              <span className="text-white/70 text-xs truncate">{article.source.name}</span>
            </div>
            <h2 className="news-headline text-white text-xl md:text-2xl lg:text-3xl font-semibold leading-tight mb-1.5 group-hover:text-blue-200 transition-colors line-clamp-2">
              {article.title}
            </h2>
            <div className="flex items-center gap-3 text-white/70 text-xs flex-wrap">
              <span className="truncate">{formatNewsDate(article.publishedAt, language)}</span>
              <span className="text-white/40">•</span>
              <span className="inline-flex items-center gap-0.5">
                <Clock3 size={11} />
                {article.readability.readingTimeMin > 0 ? `${article.readability.readingTimeMin}m` : 'Quick'}
              </span>
            </div>
          </Link>
        </motion.div>
      </AnimatePresence>

      {/* Navigation arrows */}
      <button
        onClick={prev}
        aria-label={t.previous}
        title={t.previous}
        className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 md:w-9 md:h-9 bg-black/30 hover:bg-black/50 rounded-full flex items-center justify-center text-white transition-colors backdrop-blur-sm"
      >
        <ChevronLeft size={16} />
      </button>
      <button
        onClick={next}
        aria-label={t.next}
        title={t.next}
        className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 md:w-9 md:h-9 bg-black/30 hover:bg-black/50 rounded-full flex items-center justify-center text-white transition-colors backdrop-blur-sm"
      >
        <ChevronRight size={16} />
      </button>

      {/* Dots indicator — each button gets a 24px tap target (p-2.5) around a small
          visible dot, plus an accessible name for screen readers. */}
      <div className="absolute bottom-1 right-2 flex items-center z-10">
        {headlines.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            aria-label={`${t.goToSlide} ${i + 1}`}
            aria-current={i === idx ? 'true' : undefined}
            className="p-2.5 flex items-center"
          >
            <span
              className={`block h-1.5 w-5 origin-center rounded-full motion-safe:transition-[transform,background-color] motion-safe:duration-200 motion-safe:ease-out ${i === idx ? 'scale-x-100 bg-blue-400' : 'scale-x-[0.3] bg-white/40 hover:bg-white/70'}`}
            />
          </button>
        ))}
      </div>

      {/* Autoplay progress. This is also the timer: the next slide is shown when the bar
          finishes. A new key per slide restarts it from zero on every slide change, however
          it was reached, so each slide gets the same five visible seconds. */}
      {autoplay && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/15 z-10 rounded-b-2xl overflow-hidden" aria-hidden="true">
          <div
            key={idx}
            data-testid="hero-progress"
            className="hero-progress h-full origin-left bg-blue-400"
            style={{ animationPlayState: paused || tabHidden ? 'paused' : 'running' }}
            onAnimationEnd={(event) => { if (event.target === event.currentTarget) next(); }}
          />
        </div>
      )}
    </div>
  );
}
