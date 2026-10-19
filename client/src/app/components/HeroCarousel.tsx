import { SkeletonBlock } from './ui/ContentSkeleton';
import { useUiText } from '../i18n/uiText';
import { useTitleTranslations } from '../hooks/useTitleTranslations';
import { useState, useEffect } from 'react';
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
    neutral: 'bg-gray-500/90 text-white',
    negative: 'bg-red-500/90 text-white',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${colors[sentiment as keyof typeof colors]}`}>
      {t[sentiment]}
    </span>
  );
}

/** Responsive hero height: fits a 360px phone, reads well in the 760px column. */
const HERO_HEIGHT = 'h-[300px] sm:h-[360px] md:h-[420px]';

export function HeroCarousel() {
  const ui = useUiText();
  const { t, isDark, language, selectedCategory, selectedSources, selectedSentiment } = useApp();
  const shouldReduceMotion = useReducedMotion();
  const [current, setCurrent] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

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
    if (isHovered || shouldReduceMotion || headlines.length === 0) return;
    const interval = setInterval(() => {
      if (document.hidden) return;
      setCurrent(p => (p + 1) % headlines.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isHovered, shouldReduceMotion, headlines.length]);

  const prev = () => setCurrent(p => (p - 1 + headlines.length) % headlines.length);
  const next = () => setCurrent(p => (p + 1) % headlines.length);

  if (isLoading) {
    return <div role="status" aria-label={t.loading}><span className="sr-only">{t.loading}</span><SkeletonBlock className={`${HERO_HEIGHT} w-full rounded-2xl`} /></div>;
  }

  // Loaded but no match for the active filters — the feed's own empty state covers it.
  if (headlines.length === 0) return null;

  // Clamp: a filter change can shrink the list before the reset effect runs.
  const idx = current % headlines.length;
  const article = headlines[idx];
  const topicClass = TOPIC_BADGE_CLASS[article.topic];

  return (
    <div
      className={`${HERO_HEIGHT} relative overflow-hidden transition-[border-color,box-shadow] duration-200 ease-out rounded-2xl border shadow-lg`}
      style={{
        overflowAnchor: 'none',
        borderColor: isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(255, 255, 255, 0.6)',
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.4)' : 'rgba(255, 255, 255, 0.4)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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
            fetchPriority="high"
            loading="eager"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent rounded-xl" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent rounded-xl" />
        </motion.div>
      </AnimatePresence>

      {/* Trending badge */}
      <div className="absolute top-3 left-4 flex items-center gap-2 z-10">
        <div className="flex items-center gap-1.5 bg-[#173a63] text-white px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider shadow-sm">
          <TrendingUp size={10} />
          {t.topHeadlines}
        </div>
      </div>

      {/* Content */}
      <AnimatePresence initial={false}>
        <motion.div
          key={`content-${idx}`}
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.3 }}
          className="absolute bottom-0 left-0 right-0 px-4 pt-4 pb-10 md:p-5 z-10"
        >
          <Link to={`/article/${getArticleId(article)}`} className="block group">
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              <SentimentBadge sentiment={article.sentiment.type} />
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${topicClass}`}>{ui(article.topic)}</span>
              <span className="text-white/70 text-[11px] truncate">{article.source.name}</span>
            </div>
            <h2 className="font-poppins text-white text-xl md:text-2xl lg:text-3xl font-semibold leading-tight mb-1.5 group-hover:text-blue-200 transition-colors line-clamp-2">
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
              className={`block transition-all duration-300 rounded-full ${i === idx ? 'w-5 h-1.5 bg-cyan-400' : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/70'}`}
            />
          </button>
        ))}
      </div>

      {/* Progress bar */}
      {!shouldReduceMotion && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/15 z-10 rounded-b-2xl overflow-hidden">
          <motion.div
            key={idx}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 5, ease: 'linear' }}
            className="h-full origin-left bg-blue-400"
          />
        </div>
      )}
    </div>
  );
}
