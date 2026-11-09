import { CATEGORIES, CATEGORY_LABELS, postCategoryBadgeClass } from '../../constants';
import { useUiText } from '../../i18n/uiText';
import { StyledSelect } from '../ui/StyledSelect';

const postCategories = ['General', ...CATEGORIES.map(category => CATEGORY_LABELS[category])];

/**
 * Compact category dropdown for posts. `filter` adds an "All categories"
 * option (value '') and sits beside the sort control; `compose` renders a
 * small pill coloured like the badge the post will carry; the filter
 * trigger fills with the category's colour once one is picked.
 */
export function PostCategorySelect({ value, onChange, label, variant }: {
  value: string;
  onChange: (category: string) => void;
  label: string;
  variant: 'filter' | 'compose';
}) {
  const ui = useUiText();
  const options = [
    ...(variant === 'filter' ? [{ value: '', label: ui('All categories') }] : []),
    ...postCategories.map(category => ({ value: category, label: ui(category) })),
  ];
  const className = variant === 'compose'
    ? `min-h-8 pointer-coarse:min-h-10 px-3 font-semibold ${postCategoryBadgeClass(value)}`
    // Same corner, border and surface as the sort track beside it.
    : `self-stretch shrink-0 rounded-xl! px-3 max-sm:px-2 text-[13px] font-semibold ${value
      ? `border border-transparent ${postCategoryBadgeClass(value)}`
      : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white'}`;
  return <StyledSelect variant="chip" value={value} onChange={onChange} options={options} label={label} className={className} />;
}
