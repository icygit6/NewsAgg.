import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';

type Option<T extends string> = { value: T; label: string; disabled?: boolean };

/** Shared single-choice picker: keyboard navigation, typeahead and focus restoration. */
export function StyledSelect<T extends string>({ value, onChange, options, label, isDark = false, disabled = false, className = '' }: {
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
  label: string;
  isDark?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  // Radix reserves an empty value for its placeholder. Encode by index so an
  // actual empty filter and user-created collection names cannot collide.
  const index = options.findIndex((option) => option.value === value);
  return (
    <Select.Root value={index < 0 ? '' : `option-${index}`} onValueChange={(key) => {
      const option = options[Number(key.slice(7))];
      if (option) onChange(option.value);
    }} disabled={disabled}>
      <Select.Trigger aria-label={label} className={`group flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-sm font-medium shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/40 data-[state=open]:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 ${isDark ? 'border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-800 hover:border-blue-300 hover:bg-blue-50/40'} ${className}`}>
        <span className="truncate"><Select.Value placeholder={label} /></span>
        <Select.Icon><ChevronDown size={16} className="shrink-0 text-slate-400 transition-transform group-data-[state=open]:rotate-180" /></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content position="popper" sideOffset={6} collisionPadding={12} className={`z-[200] max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border p-1.5 shadow-xl motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 ${isDark ? 'border-slate-700 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-800'}`}>
          <Select.ScrollUpButton className="flex justify-center py-1"><ChevronUp size={16} /></Select.ScrollUpButton>
          <Select.Viewport className="max-h-64">
            {options.map((option, i) => (
              <Select.Item key={option.value} value={`option-${i}`} disabled={option.disabled} className={`relative flex min-h-10 cursor-pointer select-none items-center rounded-lg py-2 pl-3 pr-9 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 ${isDark ? 'data-[highlighted]:bg-slate-800 data-[state=checked]:text-blue-300' : 'data-[highlighted]:bg-blue-50 data-[state=checked]:text-blue-700'} data-[state=checked]:font-semibold`}>
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
