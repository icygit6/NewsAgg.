import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';

type Option<T extends string> = { value: T; label: string; disabled?: boolean };

/** Shared single-choice picker: keyboard navigation, typeahead and focus restoration. */
export function StyledSelect<T extends string>({ value, onChange, options, label, isDark = false, disabled = false, className = '', variant = 'field' }: {
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
  label: string;
  isDark?: boolean;
  disabled?: boolean;
  className?: string;
  /** 'chip' renders the trigger as a small pill; the caller's className sets its colours. */
  variant?: 'field' | 'chip';
}) {
  // Radix reserves an empty value for its placeholder. Encode by index so an
  // actual empty filter and user-created collection names cannot collide.
  const index = options.findIndex((option) => option.value === value);
  return (
    <Select.Root value={index < 0 ? '' : `option-${index}`} onValueChange={(key) => {
      const option = options[Number(key.slice(7))];
      if (option) onChange(option.value);
    }} disabled={disabled}>
      <Select.Trigger aria-label={label} className={variant === 'chip' ? `group inline-flex min-w-0 max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--brand)]/40 ${className}` : `group flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-sm font-medium shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--brand)]/40 data-[state=open]:border-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-50 ${isDark ? 'border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-800 hover:border-[var(--brand)] hover:bg-[color-mix(in_srgb,var(--brand)_10%,transparent)]'} ${className}`}>
        <span className="truncate"><Select.Value placeholder={label} /></span>
        <Select.Icon><ChevronDown size={variant === 'chip' ? 12 : 16} className={`shrink-0 transition-transform group-data-[state=open]:rotate-180 ${variant === 'chip' ? 'opacity-70' : 'text-slate-400'}`} /></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content position="popper" sideOffset={6} collisionPadding={12} className={`z-[200] max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border p-1.5 shadow-xl duration-150 motion-reduce:transition-none motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100`}>
          <Select.ScrollUpButton className="flex justify-center py-1"><ChevronUp size={16} /></Select.ScrollUpButton>
          <Select.Viewport className="max-h-64">
            {options.map((option, i) => (
              <Select.Item key={option.value} value={`option-${i}`} disabled={option.disabled} className={`relative flex min-h-10 cursor-pointer select-none items-center rounded-lg py-2 pl-3 pr-9 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 ${isDark ? 'data-[highlighted]:bg-slate-800 data-[state=checked]:text-[var(--brand)]' : 'data-[highlighted]:bg-[color-mix(in_srgb,var(--brand)_10%,transparent)] data-[state=checked]:text-[var(--brand)]'} data-[state=checked]:font-semibold`}>
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator className="absolute right-3"><Check size={16} /></Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
          <Select.ScrollDownButton className="flex justify-center py-1"><ChevronDown size={16} /></Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
