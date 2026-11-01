import { Languages } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { SwitchTrack } from './SwitchTrack';

/**
 * One on/off switch for news translation, separate from the interface
 * language. Off (the default) keeps every story in its published language;
 * on translates headlines and articles into the interface language.
 */
export function TranslateNewsToggle({ isDark, compact = false, tray = false }: { isDark: boolean; compact?: boolean; tray?: boolean }) {
  const { t, newsMode, setNewsMode } = useApp();
  const on = newsMode === 'translated';
  // tray: the filled row of the account drawer, matching the theme picker's "Your own colour".
  const surface = tray
    ? `rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200`
    : `rounded-xl hover:bg-slate-100 text-slate-700 dark:hover:bg-slate-800 dark:text-slate-200`;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => setNewsMode(on ? 'original' : 'translated')}
      className={`flex w-full items-center gap-3 text-left transition-colors ${compact ? 'px-3 py-2' : 'px-3 py-2.5'} ${surface}`}
    >
      {!compact && <Languages size={16} className={`shrink-0 ${tray ? 'text-slate-500 dark:text-slate-400' : 'text-blue-600 dark:text-blue-400'}`} />}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{t.translateNews}</span>
        <span className={`block text-xs leading-relaxed text-slate-500 dark:text-slate-400`}>
          {on ? t.translateNewsOn : t.translateNewsOff}
        </span>
      </span>
      <SwitchTrack on={on} isDark={isDark} />
    </button>
  );
}

