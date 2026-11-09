import type { ReactNode } from 'react';
import { segment } from './styles';

interface Option<T extends string> { value: T; label: ReactNode; title?: string }

/** The shared segment track with one raised choice: Light/Dark in the theme picker and the
 * interface language in the account drawer use it, like every other tab set on the site. */
export function SegmentedControl<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: Option<T>[]; onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`${segment.track} flex w-full`}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.title}
            onClick={() => !active && onChange(option.value)}
            className={`flex min-w-0 flex-1 items-center justify-center gap-2 min-h-9 ${active ? segment.active : segment.item}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
