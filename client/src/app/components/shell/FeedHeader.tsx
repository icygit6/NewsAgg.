import { useUiText } from '../../i18n/uiText';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Link } from 'react-router';
import { SlidersHorizontal, Search, X, Sun, Moon, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../../contexts/AppContext';
import { useEdgeScroll } from '../../hooks/useEdgeScroll';
import { CATEGORIES, CATEGORY_BADGE_CLASS, CATEGORY_LABELS, type Category } from '../../constants';
import { FilterSheet } from '../ui/FilterSheet';
import { BrandLogo } from '../ui/BrandLogo';
import { SearchBox } from './SearchBox';

export function FeedHeader() {
  const ui = useUiText();
  const {
    t,
    isDark,
    toggleTheme,
    selectedCategory,
    setSelectedCategory,
    selectedSources,
    selectedSentiment,
    selectedSort,
  } = useApp();

  const [filterOpen, setFilterOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // Separate anchors: the mobile row and the desktop row each render their own
  // filter button, and the mobile sheet drops down from its own one.
  const mobileFilterRef = useRef<HTMLDivElement>(null);
  const desktopFilterRef = useRef<HTMLDivElement>(null);
  const { ref: chipsRef, canScrollLeft, canScrollRight, scrollByPage } = useEdgeScroll<HTMLDivElement>();

  useEffect(() => {
    const active = chipsRef.current?.querySelector<HTMLElement>('[aria-current="true"]');
    active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [chipsRef, selectedCategory]);

  const filterActiveCount =
    selectedSources.length +
    (selectedSentiment !== 'all' ? 1 : 0) +
    (selectedSort !== 'latest' ? 1 : 0);

  const chip = (key: Category | 'all', label: string) => {
    const active = selectedCategory === key;
    const activeClass = key === 'all' ? 'text-white' : CATEGORY_BADGE_CLASS[key];
    return (
      <button
        key={key}
        onClick={() => setSelectedCategory(key)}
        aria-current={active ? 'true' : undefined}
        className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
          active
            ? activeClass
            : isDark
              ? 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
        }`}
        style={active && key === 'all' ? { background: 'var(--brand-grad, #2563eb)' } : undefined}
      >
        {label}
      </button>
    );
  };

  const iconBtn = `p-2 rounded-full transition-colors ${
    isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'
  }`;

  const filterBtn = (anchorRef: RefObject<HTMLDivElement>) => (
    <div ref={anchorRef} className="relative shrink-0">
      <button
        onClick={() => setFilterOpen((p) => !p)}
        aria-label={t.filter}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
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
      <FilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} anchorRef={anchorRef} />
    </div>
  );

  return (
    <header
      className={`z-30 border-b shrink-0 md:h-[88px] ${
        isDark ? 'border-slate-800/50' : 'border-slate-200/50'
      }`}
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
        <button onClick={toggleTheme} aria-label={ui("Toggle theme")} className={iconBtn}>
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      {/* Desktop: filter + chips + search icon */}
      <div className="hidden md:flex items-stretch h-full">
        <div className="flex-1 min-w-0 flex items-center gap-2 px-3">
          <Link to="/" className="shrink-0 lg:hidden" aria-label={ui("NewsAgg home")}>
            <BrandLogo showWordmark={false} markClassName="w-9 h-9" />
          </Link>
          {filterBtn(desktopFilterRef)}

          {/* Scrollable chips */}
          <div className="relative flex-1 min-w-0 flex items-center">
            {canScrollLeft && (
              <button
                type="button"
                onClick={() => scrollByPage(-1)}
                aria-label={ui("Previous categories")}
                className={`absolute left-0 z-10 h-8 w-8 rounded-full border shadow-sm flex items-center justify-center ${isDark ? 'bg-slate-950 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`}
              >
                <ChevronLeft size={16} />
              </button>
            )}
            <div
              ref={chipsRef}
              className="no-scrollbar flex w-full gap-2 overflow-x-auto overscroll-x-contain scroll-smooth px-1"
              style={{
                scrollbarWidth: 'none',
                maskImage:
                  'linear-gradient(90deg, transparent 0, black 14px, black calc(100% - 14px), transparent 100%)',
              }}
            >
              {chip('all', t.allCategories)}
              {CATEGORIES.map((c) => chip(c, ui(CATEGORY_LABELS[c])))}
            </div>
            {canScrollRight && (
              <button
                type="button"
                onClick={() => scrollByPage(1)}
                aria-label={ui("Next categories")}
                className={`absolute right-0 z-10 h-8 w-8 rounded-full border shadow-sm flex items-center justify-center ${isDark ? 'bg-slate-950 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`}
              >
                <ChevronRight size={16} />
              </button>
            )}
          </div>

          {/* Search toggle — right edge */}
          <div className="relative ml-auto shrink-0">
            <button
              onClick={() => setSearchOpen((p) => !p)}
              aria-label={t.search}
              className={`${iconBtn} ${searchOpen ? 'text-[var(--brand,#2563eb)]' : ''}`}
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
