import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect } from 'react';
import { CATEGORIES, CATEGORY_ACCENT, CATEGORY_LABELS } from '../../constants';
import { useEdgeScroll } from '../../hooks/useEdgeScroll';
import { useUiText } from '../../i18n/uiText';
import { CategoryScrollFrame } from '../ui/CategoryScrollFrame';

const postCategories = ['General', ...CATEGORIES.map(category => CATEGORY_LABELS[category])];

export function PostCategoryPicker({ value, onChange, allLabel, isDark, ariaLabel }: {
  value: string;
  onChange: (category: string) => void;
  /** Label for an extra "no category" chip; omit to offer only real categories. */
  allLabel?: string;
  isDark: boolean;
  ariaLabel: string;
}) {
  const ui = useUiText();
  const { ref, canScrollLeft, canScrollRight, scrollByPage, revealItem } = useEdgeScroll<HTMLDivElement>(200);
  useEffect(() => {
    const active = ref.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (active) revealItem(active, true);
  }, [ref, value, revealItem]);
  const arrow = `flex h-9 w-9 pointer-coarse:h-11 pointer-coarse:w-11 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${isDark ? 'border-slate-700 bg-slate-900 text-slate-200 enabled:hover:bg-slate-800 disabled:text-slate-600' : 'border-slate-200 bg-white text-slate-700 enabled:hover:bg-slate-50 disabled:text-slate-400'}`;

  return <CategoryScrollFrame previous={<button type="button" disabled={!canScrollLeft} aria-hidden={!canScrollLeft} style={{ opacity: canScrollLeft ? 1 : 0, pointerEvents: canScrollLeft ? 'auto' : 'none' }} onClick={() => scrollByPage(-1)} aria-label={ui('Scroll categories left')} className={arrow}>
      <ChevronLeft size={15} />
    </button>} next={<button type="button" disabled={!canScrollRight} aria-hidden={!canScrollRight} style={{ opacity: canScrollRight ? 1 : 0, pointerEvents: canScrollRight ? 'auto' : 'none' }} onClick={() => scrollByPage(1)} aria-label={ui('Scroll categories right')} className={arrow}>
      <ChevronRight size={15} />
    </button>}>
    <div ref={ref} data-testid="post-categories" role="group" aria-label={ariaLabel} className="no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto overscroll-x-contain px-1 py-1">
      {[...(allLabel ? [{ value: '', label: allLabel }] : []), ...postCategories.map(label => ({ value: label, label: ui(label) }))].map(option => {
        const active = value === option.value;
        const category = CATEGORIES.find(item => CATEGORY_LABELS[item] === option.value);
        const dot = category ? CATEGORY_ACCENT[category] : undefined;
        return <button key={option.value} type="button" aria-pressed={active} onClick={() => onChange(option.value)}
          style={active && dot ? { background: dot } : undefined}
          className={`inline-flex min-h-9 pointer-coarse:min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${active ? `border-transparent font-semibold text-white ${dot ? '' : 'bg-[var(--brand)]'}` : isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
          {dot && !active && <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: dot }} />}
          {option.label}
        </button>;
      })}
    </div>
  </CategoryScrollFrame>;
}
