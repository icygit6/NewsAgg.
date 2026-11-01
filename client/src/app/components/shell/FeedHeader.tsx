import { useUiText } from '../../i18n/uiText';
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

export function FeedHeader() {
  const ui = useUiText();
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

  // An active chip takes its category's colour; the inactive ones show it as a dot.
  const chip = (key: Category | 'all', label: string) => {
    const active = key === 'all' ? selectedCategories.length === 0 : selectedCategories.includes(key);
    return (
      <button
        key={key}
        onClick={() => setSelectedCategory(key)}
        aria-current={active ? 'true' : undefined}
        style={active ? { background: key === 'all' ? 'var(--brand)' : CATEGORY_ACCENT[key] } : undefined}
        className={`shrink-0 inline-flex min-h-9 pointer-coarse:min-h-11 items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${
          active
            ? 'border-transparent font-semibold text-white'
            : isDark
              ? 'bg-slate-900 text-slate-300 hover:bg-slate-800 border-slate-800'
              : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200'
        }`}
      >
        {key !== 'all' && (
          !active && <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: CATEGORY_ACCENT[key] }} />
        )}
        {label}
      </button>
    );
  };

  // Sized up to a 44px target on touch screens; display is set per button so
  // the tablet-only theme toggle can keep its `hidden md:inline-flex`.
  const iconBtn = `items-center justify-center p-2 pointer-coarse:min-h-11 pointer-coarse:min-w-11 rounded-full transition-colors ${
    isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'
  }`;

  const filterBtn = (anchorRef: RefObject<HTMLDivElement>, align: 'left' | 'right' = 'left') => (
    <div ref={anchorRef} className="relative shrink-0">
      <button
        onClick={() => setFilterOpen((p) => !p)}
        aria-label={t.filter}
        className={`flex items-center justify-center gap-1.5 px-3 py-1.5 pointer-coarse:min-h-11 pointer-coarse:min-w-11 rounded-full text-sm font-medium transition-colors ${
          filterActiveCount > 0
            ? 'text-[var(--brand,#2563eb)]'
            : isDark
              ? 'text-slate-300 hover:bg-slate-800'
              : 'text-slate-600 hover:bg-slate-100'
        }`}
      >
        <SlidersHorizontal size={16} />
        {filterActiveCount > 0 && (
          <span
            className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-white text-[11px] font-bold"
            style={{ background: 'var(--brand, #2563eb)' }}
          >
            {filterActiveCount}
          </span>
        )}
      </button>
      <FilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} anchorRef={anchorRef} align={align} />
    </div>
  );

  return (
    <header
      className="z-30 shrink-0 md:h-[88px]"
    >
      {/* Mobile: search bar row */}
      <div className="md:hidden flex items-center gap-2 px-3 py-2.5">
        <Link to="/" className="shrink-0" aria-label={ui("NewsAgg home")}>
          <BrandLogo showWordmark={false} markClassName="w-9 h-9" />
        </Link>
        <div className="flex-1 min-w-0">
          <SearchBox />
        </div>
        {filterBtn(mobileFilterRef)}
        <button onClick={toggleTheme} aria-label={ui("Toggle theme")} className={`${iconBtn} inline-flex`}>
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      {/* Desktop: chips, then filter and search side by side at the right edge */}
      <div className="hidden md:flex items-stretch h-full">
        <div className="flex-1 min-w-0 flex items-center gap-2 px-3">
          <Link to="/" className="shrink-0 lg:hidden" aria-label={ui("NewsAgg home")}>
            <BrandLogo showWordmark={false} markClassName="w-9 h-9" />
          </Link>
          {/* Scrollable chips */}
          <CategoryScrollFrame className="flex-1" previous={
              <button
                type="button"
                onClick={() => scrollByPage(-1)}
                disabled={!canScrollLeft}
                aria-hidden={!canScrollLeft}
                style={{ opacity: canScrollLeft ? 1 : 0, pointerEvents: canScrollLeft ? 'auto' : 'none' }}
                aria-label={ui("Previous categories")}
                className={`flex h-9 w-9 pointer-coarse:h-11 pointer-coarse:w-11 shrink-0 items-center justify-center rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${isDark ? 'bg-slate-950 border-slate-700 text-slate-200 disabled:text-slate-600' : 'bg-white border-slate-200 text-slate-700 disabled:text-slate-400'}`}
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
                className={`flex h-9 w-9 pointer-coarse:h-11 pointer-coarse:w-11 shrink-0 items-center justify-center rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${isDark ? 'bg-slate-950 border-slate-700 text-slate-200 disabled:text-slate-600' : 'bg-white border-slate-200 text-slate-700 disabled:text-slate-400'}`}
              >
                <ChevronRight size={16} />
              </button>
            }>
            <div
              ref={chipsRef}
              data-testid="feed-categories"
              role="group"
              aria-label={ui('Categories')}
              className="no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto overscroll-x-contain px-1 py-1"
              style={{ scrollbarWidth: 'none' }}
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
              {searchOpen ? <X size={18} /> : <Search size={18} />}
            </button>

            <AnimatePresence>
              {searchOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className={`absolute right-0 top-full mt-2 w-80 rounded-2xl border shadow-xl overflow-hidden z-50 ${
                    isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'
                  }`}
                >
                  <div className="p-3">
                    <SearchBox />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button
            onClick={toggleTheme}
            aria-label={ui("Toggle theme")}
            className={`${iconBtn} hidden shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 md:inline-flex lg:hidden`}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>
    </header>
  );
}
