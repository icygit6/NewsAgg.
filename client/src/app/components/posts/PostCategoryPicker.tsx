import { CATEGORIES, CATEGORY_BADGE_CLASS, CATEGORY_LABELS } from '../../constants';
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
  return <div role="group" aria-label={ariaLabel} className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
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
  </div>;
}
