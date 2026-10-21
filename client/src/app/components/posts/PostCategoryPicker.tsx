import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CATEGORIES, CATEGORY_BADGE_CLASS, CATEGORY_LABELS } from '../../constants';
import { useEdgeScroll } from '../../hooks/useEdgeScroll';
import { useUiText } from '../../i18n/uiText';

const postCategories = ['General', ...CATEGORIES.map(category => CATEGORY_LABELS[category])];

export function PostCategoryPicker({ value, onChange, allLabel, isDark, ariaLabel }: {
  value: string;
  onChange: (category: string) => void;
  allLabel: string;
  isDark: boolean;
  ariaLabel: string;
}) {
  const ui = useUiText();
  // The strip hides its scrollbar; the edge arrows are the only affordance, so
  // each one appears exactly while there is more to reach on that side.
  const { ref, canScrollLeft, canScrollRight, scrollByPage } = useEdgeScroll<HTMLDivElement>(200);
  const arrow = `absolute top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border shadow-sm transition-colors ${isDark ? 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`;

  return <div className="relative">
    {canScrollLeft && <button type="button" onClick={() => scrollByPage(-1)} aria-label={ui('Scroll categories left')} className={`${arrow} left-0`}>
      <ChevronLeft size={15} />
    </button>}
    <div ref={ref} role="group" aria-label={ariaLabel} className="no-scrollbar flex gap-2 overflow-x-auto overscroll-x-contain scroll-smooth pb-1">
      {[{ value: '', label: allLabel }, ...postCategories.map(label => ({ value: label, label: ui(label) }))].map(option => {
        const active = value === option.value;
        const category = CATEGORIES.find(item => CATEGORY_LABELS[item] === option.value);
        const color = category ? CATEGORY_BADGE_CLASS[category] : 'bg-slate-500 text-white';
        return <button key={option.value} type="button" aria-pressed={active} onClick={() => onChange(option.value)}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${active ? `${color} border-transparent shadow-sm` : isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
          {!active && option.value && <span aria-hidden="true" className={`h-2 w-2 rounded-full ${color.split(' ')[0]}`} />}
          {option.label}
        </button>;
      })}
    </div>
    {canScrollRight && <button type="button" onClick={() => scrollByPage(1)} aria-label={ui('Scroll categories right')} className={`${arrow} right-0`}>
      <ChevronRight size={15} />
    </button>}
  </div>;
}
