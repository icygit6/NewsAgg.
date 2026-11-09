import { segment } from './styles';
import { useUiText } from '../../i18n/uiText';
import { useState, useEffect, useRef, type RefObject } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { X, Newspaper } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { CATEGORIES, CATEGORY_BADGE_CLASS, CATEGORY_LABELS, CATEGORY_TEXT, SOURCES, categoryVars, sourceLogoUrl, type Category } from '../../constants';
import { ImageWithFallback } from '../utils/ImageWithFallback';
import type { SentimentType } from '../../types/sentiment';
import type { ArticleSort } from '../../services/newsAPI';
import { filterCount, type FilterControl } from './filterControl';

interface FilterSheetProps {
  open: boolean;
  onClose: () => void;
  // Button the panel belongs to. The small-screen panel drops down from just
  // below it instead of rising from the bottom of the window.
  anchorRef?: RefObject<HTMLElement | null>;
  /** Filters to edit instead of the home feed's (the bookmarks page has its own). */
  control?: FilterControl;
  /** Which edge of the anchor the desktop dropdown lines up with. */
  align?: 'left' | 'right';
}


type FilterTab = 'category' | 'source' | 'sentiment' | 'sort';

const SENTIMENT_OPTIONS: SentimentType[] = ['positive', 'neutral', 'negative'];

// Desktop renders an anchored dropdown, mobile a bottom sheet. The breakpoint
// mirrors Tailwind's `md` so it stays in sync with the rest of the layout.
function useIsDesktop(): boolean {
  const query = '(min-width: 768px)';
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

/** Top offset for the small-screen panel: just under the filter button, so it
 * reads as that button's dropdown. Re-measured on scroll and resize. */
function useAnchorBottom(anchorRef: RefObject<HTMLElement | null> | undefined, active: boolean): number {
  const [top, setTop] = useState(8);
  useEffect(() => {
    if (!active) return;
    const measure = () => {
      const rect = anchorRef?.current?.getBoundingClientRect();
      setTop(rect ? Math.max(8, rect.bottom + 8) : 8);
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [anchorRef, active]);
  return top;
}

export function FilterSheet({ open, onClose, anchorRef, control, align = 'left' }: FilterSheetProps) {
  const ui = useUiText();
  const reducedMotion = useReducedMotion();
  const {
    t,
    isDark,
    selectedCategories, setSelectedCategories, selectedSentiments, setSelectedSentiments,
    setSelectedCategory,
    selectedSources,
    setSelectedSources,
    setSelectedSentiment,
    selectedSort,
    setSelectedSort,
  } = useApp();
  const [tab, setTab] = useState<FilterTab>('category');
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!panelRef.current?.getClientRects().length) return;
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !anchorRef?.current?.contains(target)) onClose();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', escape); };
  }, [open, onClose, anchorRef]);
  const isDesktop = useIsDesktop();
  const anchorBottom = useAnchorBottom(anchorRef, open && !isDesktop);

  // The home feed's filters, used when no control is passed. Emptying a list
  // goes through the 'all' setters, which also reset the single selection.
  const feed: FilterControl = {
    categories: selectedCategories,
    setCategories: (value) => value.length ? setSelectedCategories(value as typeof selectedCategories) : setSelectedCategory('all'),
    sources: selectedSources,
    setSources: setSelectedSources,
    sentiments: selectedSentiments,
    setSentiments: (value) => value.length ? setSelectedSentiments(value) : setSelectedSentiment('all'),
    sort: selectedSort,
    setSort: (value) => setSelectedSort(value as ArticleSort),
    sortOptions: [
      { value: 'top', label: t.topStories },
      { value: 'latest', label: t.newestFirst },
      { value: 'oldest', label: t.oldestFirst },
    ],
    defaultSort: 'latest',
  };
  const c = control ?? feed;
  const toggle = <T,>(list: T[], value: T) => list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

  const clearAll = () => {
    c.setCategories([]);
    c.setSources([]);
    c.setSentiments([]);
    c.setSort(c.defaultSort);
  };

  const activeCount = filterCount(c);

  const sentimentLabel: Record<SentimentType, string> = {
    positive: t.positive,
    neutral: t.neutral,
    negative: t.negative,
  };

  // Shared panel body — only one variant (dropdown or sheet) mounts at a time.
  const body = (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header row */}
      <div
        className={`flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`font-poppins text-sm font-semibold text-slate-900 dark:text-slate-100`}
          >
            {t.filters}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {activeCount > 0 && (
            <button
              onClick={clearAll}
              className={`text-xs font-medium px-2 py-1 rounded-md transition-colors text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-700`}
            >
              {t.clearFilters}
            </button>
          )}
          <button
            onClick={onClose}
            aria-label={ui("Close filters")}
            className={`p-1.5 rounded-md transition-colors text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-700`}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Tabs: one line each, in the same track as the Insights / Pulse switch. Sized to their
          labels (flex-auto) so "Sentiment" fits beside "Sort" on a 375px phone. */}
      <div className="border-b border-slate-100 p-3 dark:border-slate-700"><div className={`${segment.track} flex w-full`}>
        {(
          [
            { key: 'category', label: t.byCategory },
            { key: 'source', label: t.bySource },
            { key: 'sentiment', label: t.bySentiment },
            { key: 'sort', label: t.sort },
          ] as const
        ).map(({ key, label }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              aria-pressed={active}
              className={`flex-auto min-w-0 min-h-9 truncate text-center max-sm:px-2 ${active ? segment.active : segment.item}`}
            >
              {label}
            </button>
          );
        })}
      </div></div>

      {/* Tab content */}
      <div className="p-4 flex-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {tab === 'category' ? (
          <div className="flex flex-wrap gap-2.5">
            <CategoryChip
              label={t.allCategories}
              active={c.categories.length === 0}
              isDark={isDark}
              onClick={() => c.setCategories([])}
            />
            {CATEGORIES.map((cat) => (
              <CategoryChip
                key={cat}
                label={ui(CATEGORY_LABELS[cat])}
                active={c.categories.includes(cat)}
                isDark={isDark}
                category={cat}
                onClick={() => c.setCategories(toggle(c.categories, cat))}
              />
            ))}
          </div>
        ) : tab === 'sentiment' ? (
          <div className="flex flex-wrap gap-2.5">
            <CategoryChip
              label={t.allSentiment}
              active={c.sentiments.length === 0}
              isDark={isDark}
              onClick={() => c.setSentiments([])}
            />
            {SENTIMENT_OPTIONS.map((s) => (
              <CategoryChip
                key={s}
                label={sentimentLabel[s]}
                active={c.sentiments.includes(s)}
                isDark={isDark}
                tone={s}
                onClick={() => c.setSentiments(toggle(c.sentiments, s))}
              />
            ))}
          </div>
        ) : tab === 'sort' ? (
          <div className="flex flex-col gap-1.5">
            {c.sortOptions.map((option) => (
              <SortOption
                key={option.value}
                label={option.label}
                selected={c.sort === option.value}
                isDark={isDark}
                onClick={() => c.setSort(option.value)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {/* "All Sources" resets the multi-select (empty = no source filter) */}
            <SourceRow
              name={t.allSources}
              selected={c.sources.length === 0}
              isDark={isDark}
              onClick={() => c.setSources([])}
            />
            {SOURCES.map((s) => (
              <SourceRow
                key={s.id}
                name={s.name}
                logo={sourceLogoUrl(s.domain)}
                selected={c.sources.includes(s.id)}
                isDark={isDark}
                onClick={() => c.setSources(toggle(c.sources, s.id))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      {open &&
        (isDesktop ? (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, transform: 'translateY(-8px)' }}
            animate={{ opacity: 1, transform: 'translateY(0px)' }}
            exit={{ opacity: 0, transform: 'translateY(-8px)' }}
            transition={{ duration: reducedMotion ? 0 : 0.16, ease: [0.23, 1, 0.32, 1] }}
            className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-2 w-[420px] max-w-[calc(100vw-2rem)] rounded-2xl border shadow-xl overflow-hidden z-50 flex flex-col max-h-[calc(100vh-80px)] bg-white border-slate-100 dark:bg-slate-800 dark:border-slate-700`}
          >
            {body}
          </motion.div>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.16 }}
              onClick={onClose}
              className="fixed inset-0 z-50 bg-black/30"
            />
            <motion.div
              initial={{ opacity: 0, transform: 'translateY(-8px)' }}
              ref={panelRef}
              animate={{ opacity: 1, transform: 'translateY(0px)' }}
              exit={{ opacity: 0, transform: 'translateY(-8px)' }}
              transition={{ duration: reducedMotion ? 0 : 0.2, ease: [0.23, 1, 0.32, 1] }}
              className={`fixed left-2 right-2 z-50 flex flex-col overflow-hidden rounded-2xl border shadow-2xl bg-white border-slate-100 dark:bg-slate-900 dark:border-slate-700`}
              style={{ top: anchorBottom, maxHeight: `calc(100vh - ${anchorBottom}px - 16px)` }}
            >
              {body}
            </motion.div>
          </>
        ))}
    </AnimatePresence>
  );
}

interface SortOptionProps {
  label: string;
  selected: boolean;
  isDark: boolean;
  onClick: () => void;
}

/** Styled like a source row: plain until hovered, the chosen one tinted and outlined.
 * min-h-12 matches a source row's height, which its 28px logo sets. */
function SortOption({ label, selected, onClick }: SortOptionProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex min-h-12 w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-800 transition-colors dark:text-slate-100 ${
        selected
          ? 'bg-blue-500/10 ring-1 ring-blue-500/40'
          : 'hover:bg-slate-100 dark:hover:bg-slate-700/60'
      }`}
    >
      {label}
    </button>
  );
}

interface CategoryChipProps {
  label: string;
  active: boolean;
  isDark: boolean;
  onClick: () => void;
  // Optional semantic tone for sentiment chips; defaults to the theme accent.
  tone?: SentimentType;
  /** Category chips always carry the category colour: tinted when off, filled when on. */
  category?: Category;
}

const TONE_ACTIVE_CLASS: Record<SentimentType, string> = {
  positive: 'bg-emerald-500 text-white',
  neutral: 'bg-amber-500 text-amber-950',
  negative: 'bg-red-500 text-white',
};

function CategoryChip({ label, active, onClick, tone, category }: CategoryChipProps) {
  // A category chip is a soft tint of its colour until chosen, then filled like the badge on a
  // card: the choice stands out without a checkmark or ring, and ten chips don't all shout at once.
  if (category) {
    return (
      <button
        type="button"
        aria-pressed={active}
        onClick={onClick}
        style={categoryVars(category)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
          active
            ? `${CATEGORY_BADGE_CLASS[category]} shadow-sm`
            : `${CATEGORY_TEXT} bg-[color-mix(in_srgb,var(--cat)_10%,transparent)] hover:bg-[color-mix(in_srgb,var(--cat)_18%,transparent)] dark:bg-[color-mix(in_srgb,var(--cat-light)_14%,transparent)] dark:hover:bg-[color-mix(in_srgb,var(--cat-light)_24%,transparent)]`
        }`}
      >
        {label}
      </button>
    );
  }
  // "All …" is neutral ink, so it can't be mistaken for a blue category such as Politics.
  const activeClass = tone ? TONE_ACTIVE_CLASS[tone] : 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900';
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
        active
          ? activeClass
          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700/60 dark:text-slate-200 dark:hover:bg-slate-700'
      }`}
    >
      {label}
    </button>
  );
}

interface SourceRowProps {
  name: string;
  logo?: string;
  selected: boolean;
  isDark: boolean;
  onClick: () => void;
}

function SourceRow({ name, logo, selected, onClick }: SourceRowProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left transition-colors ${
        selected
          ? 'bg-blue-500/10 ring-1 ring-blue-500/40'
          : 'hover:bg-slate-100 dark:hover:bg-slate-700/60'
      }`}
    >
      {logo ? (
        <ImageWithFallback
          src={logo}
          alt={name}
          className={`w-7 h-7 rounded-md object-contain flex-shrink-0 bg-slate-100 dark:bg-slate-700`}
        />
      ) : (
        <span
          className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 bg-slate-100 dark:bg-slate-700`}
        >
          <Newspaper size={14} className="text-slate-500 dark:text-slate-300" />
        </span>
      )}
      {/* No checkbox: the tinted, outlined row shows the choice. */}
      <span className={`flex-1 text-sm font-medium text-slate-800 dark:text-slate-100`}>
        {name}
      </span>
    </button>
  );
}
