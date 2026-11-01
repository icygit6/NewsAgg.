import type { ReactNode } from 'react';

interface Option<T extends string> { value: T; label: ReactNode; title?: string }

/** Pill track with one raised choice: Light/Dark in the theme picker and the
 * interface language in the account drawer share it so they read as one set. */
export function SegmentedControl<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: Option<T>[]; onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800">
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
            className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-[13px] font-semibold transition-colors ${
              active ? 'bg-white text-slate-900 shadow-[0_1px_2px_rgb(15_23_42/0.1)] dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
