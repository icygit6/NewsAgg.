import { Languages } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';

/**
 * One on/off switch for news translation, separate from the interface
 * language. Off (the default) keeps every story in its published language;
 * on translates headlines and articles into the interface language.
 */
export function TranslateNewsToggle({ isDark, compact = false }: { isDark: boolean; compact?: boolean }) {
  const { t, newsMode, setNewsMode } = useApp();
  const on = newsMode === 'translated';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => setNewsMode(on ? 'original' : 'translated')}
      className={`flex w-full items-center gap-3 rounded-xl text-left transition-colors ${compact ? 'px-3 py-2' : 'px-3 py-2.5'} ${
        isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
      }`}
    >
      {!compact && <Languages size={16} className="shrink-0 text-cyan-500" />}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{t.translateNews}</span>
        <span className={`block text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {on ? t.translateNewsOn : t.translateNewsOff}
        </span>
      </span>
      <span
        aria-hidden="true"
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-cyan-500' : isDark ? 'bg-slate-600' : 'bg-gray-300'}`}
      >
        <span className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ease-out ${on ? 'translate-x-5' : 'translate-x-0'}`} />
      </span>
    </button>
  );
}
