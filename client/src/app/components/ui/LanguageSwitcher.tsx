import { useUiText } from '../../i18n/uiText';
import { Languages, Loader2, Sparkles } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import type { Language } from '../../i18n/translations';
import { TRANSLATION_PILLS } from '../../hooks/useInterfaceLanguage';

interface LanguageSwitcherProps {
  isDark: boolean;
  // Surfaced by the consuming page (it owns the translate request lifecycle).
  isLoading?: boolean;
  isAutoTranslated?: boolean;
  error?: string | null;
  onRetry?: () => void;
  selectedLanguage: ReadingLanguage;
  onSelectLanguage: (language: ReadingLanguage) => void;
}

/** 'original' shows a story in the language it was published in. */
export type ReadingLanguage = 'original' | Language;

export function LanguageSwitcher({ isLoading = false, isAutoTranslated = false, error, onRetry, selectedLanguage, onSelectLanguage }: LanguageSwitcherProps) {
  const ui = useUiText();
  const { t } = useApp();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Language pills */}
      <div className={`inline-flex items-center gap-1 rounded-full p-1 border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/60`}>
        <Languages size={14} className={`ml-1.5 text-slate-400 dark:text-slate-400`} />
        {[{ code: 'original' as const, short: t.newsOriginalShort }, ...TRANSLATION_PILLS].map((pill) => {
          const active = selectedLanguage === pill.code;
          return (
            <button
              key={pill.code}
              type="button"
              onClick={() => onSelectLanguage(pill.code)}
              aria-pressed={active}
              className={`min-h-8 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                active
                  ? 'bg-[var(--brand)] text-white'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {pill.short}
            </button>
          );
        })}
      </div>

      {/* Loading spinner during first-time translate */}
      {isLoading && (
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400`}>
          <Loader2 size={14} className="animate-spin" />
          {t.translating}
        </span>
      )}

      {/* Auto-translated badge */}
      {!isLoading && isAutoTranslated && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
          <Sparkles size={14} />
          {t.autoTranslated}
        </span>
      )}
      {!isLoading && error && (
        <button type="button" onClick={onRetry} className="text-xs font-semibold text-red-600 decoration-red-300 underline-offset-4 hover:underline">
          {t.noTranslation} {ui("· Retry")} </button>
      )}
    </div>
  );
}
