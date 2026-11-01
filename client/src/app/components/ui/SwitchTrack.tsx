/** The visual on/off pill for a role="switch" button; the button carries the state. */
export function SwitchTrack({ on, isDark }: { on: boolean; isDark: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-[var(--brand)]' : isDark ? 'bg-slate-600' : 'bg-gray-300'}`}
    >
      <span className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ease-out ${on ? 'translate-x-5' : 'translate-x-0'}`} />
    </span>
  );
}
