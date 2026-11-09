import { useUiPunctuation, useUiText } from '../../i18n/uiText';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Link } from 'react-router';
import { SlidersHorizontal, Search, X, Sun, Moon, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../../contexts/AppContext';
import { useEdgeScroll } from '../../hooks/useEdgeScroll';
import { CATEGORIES, CATEGORY_ACCENT, CATEGORY_LABELS, type Category } from '../../constants';
import { FilterSheet } from '../ui/FilterSheet';
import { BrandLogo } from '../ui/BrandLogo';
import { SearchBox } from './SearchBox';
import { CategoryScrollFrame } from '../ui/CategoryScrollFrame';
import { fadeMask } from '../../hooks/useScrollFade';

export function FeedHeader() {
  const ui = useUiText();
  const p = useUiPunctuation();
  const {
    t,
    isDark,
    toggleTheme,
    selectedCategory,
    selectedCategories = [], selectedSentiments = [],
    setSelectedCategory,
    selectedSources,
    selectedSort,
  } = useApp();
  // Names the theme in use, e.g. "Toggle theme (Dark)", to match the icon.
  const themeLabel = `${ui('Toggle theme')}${p.open}${ui(isDark ? 'Dark' : 'Light')}${p.close}`;

  const [filterOpen, setFilterOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // Separate anchors: the mobile row and the desktop row each render their own
  // filter button, and the mobile sheet drops down from its own one.
  const mobileFilterRef = useRef<HTMLDivElement>(null);
  const desktopFilterRef = useRef<HTMLDivElement>(null);
  const { ref: chipsRef, canScrollLeft, canScrollRight, scrollByPage, revealItem } = useEdgeScroll<HTMLDivElement>();

  useEffect(() => {
    const active = chipsRef.current?.querySelector<HTMLElement>('[aria-current="true"]');
    if (active) revealItem(active, true);
  }, [chipsRef, selectedCategory, revealItem]);

  const filterActiveCount =
    selectedSources.length +
    selectedSentiments.length + selectedCategories.length +
    (selectedSort !== 'latest' ? 1 : 0);

  // Styled like the Posts page's sort control: plain text in one soft track, and only the
  // selected chip filled (its category's colour; "All" in the track's white highlight).
  // When they all fit, chips grow to share the track's width instead of leaving a gap
  // at the end; they never shrink below their label, so a narrow track still scrolls.
  const chip = (key: Category | 'all', label: string) => {
    const active = key === 'all' ? selectedCategories.length === 0 : selectedCategories.includes(key);
    return (
      <button
        key={key}
        onClick={() => setSelectedCategory(key)}
        aria-current={active ? 'true' : undefined}
        style={active && key !== 'all' ? { background: CATEGORY_ACCENT[key] } : undefined}
        className={`shrink-0 grow inline-flex min-h-8 pointer-coarse:min-h-10 items-center justify-center whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${
          !active
            // slate-600 on the slate-100 track is ~6.9:1 (slate-500 fell just short of 4.5:1). The hover
            // is a grey tint, not white, so it never reads as a second selected chip.
            ? 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
            : key === 'all'
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
              : 'text-white shadow-sm'
        }`}
      >
        {label}
      </button>
    );
  };

  // Sized up to a 44px target on touch screens; display is set per button so
  // the tablet-only theme toggle can keep its `hidden md:inline-flex`.
  const iconBtn = `items-center justify-center p-2 pointer-coarse:min-h-11 pointer-coarse:min-w-11 rounded-full transition-colors text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800`;

  const filterBtn = (anchorRef: RefObject<HTMLDivElement>, align: 'left' | 'right' = 'left', className = '') => (
    <div ref={anchorRef} className={`relative shrink-0 ${className}`}>
      <button
        onClick={() => setFilterOpen((p) => !p)}
        aria-label={t.filter}
        className={`flex items-center justify-center gap-1.5 px-3 py-1.5 pointer-coarse:min-h-11 pointer-coarse:min-w-11 rounded-full text-sm font-medium transition-colors ${
          filterActiveCount > 0
            ? 'text-[var(--brand,#2563eb)]'
            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
        }`}
      >
        {/* No count badge: the icon turns the brand colour while any filter is on. */}
        <SlidersHorizontal size={16} />
      </button>
      <FilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} anchorRef={anchorRef} align={align} />
    </div>
  );

  return (
    <header
      className="z-30 shrink-0 md:h-[88px]"
    >
      {/* Mobile: search bar row */}
      {/* The logo and search start where TopBar's do on every other page (16px in, search at 64px); the right side keeps its own spacing. */}
      <div className="md:hidden flex items-center gap-2 pl-4 pr-3 py-2.5">
        {/* flex, like TopBar's link: an inline link leaves a descender gap under the mark, which sits it above the row's centre line. */}
        <Link to="/" className="mr-1 flex shrink-0" aria-label={ui("NewsAgg home")}>
          <BrandLogo showWordmark={false} markClassName="w-9 h-9" />
        </Link>
        <div className="flex-1 min-w-0">
          <SearchBox />
        </div>
        {/* The button's own padding already spaces the icon from the search box, so it
            cancels the row gap; the 44px touch target is unchanged. */}
        {filterBtn(mobileFilterRef, 'left', '-ml-2')}
        {/* Same as the filter: both buttons' padding does the spacing, so the gap goes. */}
        <button onClick={toggleTheme} aria-label={themeLabel} title={themeLabel} className={`${iconBtn} inline-flex -ml-2`}>
          {/* The icon shows the theme in use, not the one a press switches to. */}
          {isDark ? <Moon size={20} /> : <Sun size={20} />}
        </button>
      </div>

      {/* Desktop: chips, then filter and search side by side at the right edge */}
      <div className="hidden md:flex items-stretch h-full">
        <div className="flex-1 min-w-0 flex items-center gap-2 pl-4 pr-3">
          <Link to="/" className="flex shrink-0 lg:hidden" aria-label={ui("NewsAgg home")}>
            <BrandLogo showWordmark={false} markClassName="w-9 h-9" />
          </Link>
          {/* Scrollable chips */}
          {/* One track, as on the Posts page; the edge with more chips fades out rather than cutting a word. */}
          <CategoryScrollFrame className="flex-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-900" previous={
              <button
                type="button"
                onClick={() => scrollByPage(-1)}
                disabled={!canScrollLeft}
                aria-hidden={!canScrollLeft}
                style={{ opacity: canScrollLeft ? 1 : 0, pointerEvents: canScrollLeft ? 'auto' : 'none' }}
                aria-label={ui("Previous categories")}
                className={`flex h-9 w-9 pointer-coarse:h-11 pointer-coarse:w-11 shrink-0 items-center justify-center rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 bg-white border-slate-200 text-slate-700 disabled:text-slate-400 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-200 dark:disabled:text-slate-600`}
              >
                <ChevronLeft size={16} />
              </button>
            } next={
              <button
                type="button"
                onClick={() => scrollByPage(1)}
                disabled={!canScrollRight}
                aria-hidden={!canScrollRight}
                style={{ opacity: canScrollRight ? 1 : 0, pointerEvents: canScrollRight ? 'auto' : 'none' }}
                aria-label={ui('Next categories')}
                className={`flex h-9 w-9 pointer-coarse:h-11 pointer-coarse:w-11 shrink-0 items-center justify-center rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 bg-white border-slate-200 text-slate-700 disabled:text-slate-400 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-200 dark:disabled:text-slate-600`}
              >
                <ChevronRight size={16} />
              </button>
            }>
            <div
              ref={chipsRef}
              data-testid="feed-categories"
              role="group"
              aria-label={ui('Categories')}
              className="no-scrollbar flex min-w-0 flex-1 gap-1 overflow-x-auto overscroll-x-contain"
              style={{ scrollbarWidth: 'none', ...fadeMask(canScrollLeft, canScrollRight, 32, 'to right') }}
            >
              {chip('all', t.allCategories)}
              {CATEGORIES.map((c) => chip(c, ui(CATEGORY_LABELS[c])))}
            </div>
          </CategoryScrollFrame>

          {/* Filter, then the search toggle, at the right edge. The filter panel
              opens right-aligned so it stays on screen. */}
          {filterBtn(desktopFilterRef, 'right')}
          <div className="relative shrink-0">
            <button
              onClick={() => setSearchOpen((p) => !p)}
              aria-label={t.search}
              className={`${iconBtn} inline-flex ${searchOpen ? 'text-[var(--brand,#2563eb)]' : ''}`}
            >
              {searchOpen ? <X size={20} /> : <Search size={20} />}
            </button>

            <AnimatePresence>
              {searchOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className={`absolute right-0 top-full mt-2 w-80 rounded-2xl border shadow-xl overflow-hidden z-50 bg-white border-slate-100 dark:bg-slate-800 dark:border-slate-700`}
                >
                  <div className="p-3">
                    <SearchBox autoFocus />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button
            onClick={toggleTheme}
            aria-label={themeLabel} title={themeLabel}
            className={`${iconBtn} hidden shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 md:inline-flex lg:hidden`}
          >
            {/* The icon shows the theme in use, not the one a press switches to. */}
            {isDark ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        </div>
      </div>
    </header>
  );
}
