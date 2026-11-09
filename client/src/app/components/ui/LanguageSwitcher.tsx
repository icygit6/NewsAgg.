import { segment } from './styles';
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
      <div className={`${segment.track} items-center`}>
        <Languages size={14} className={`ml-1.5 text-slate-400 dark:text-slate-400`} />
        {[{ code: 'original' as const, short: t.newsOriginalShort }, ...TRANSLATION_PILLS].map((pill) => {
          const active = selectedLanguage === pill.code;
          return (
            <button
              key={pill.code}
              type="button"
              onClick={() => onSelectLanguage(pill.code)}
              aria-pressed={active}
              className={`min-h-8 ${active ? segment.active : segment.item}`}
            >
              {pill.short}
            </button>
          );
        })}
      </div>

      {/* Status (translating, auto-translated, retry) sits at the right end of the row. */}
      {isLoading && (
        <span className={`ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400`}>
          <Loader2 size={14} className="animate-spin" />
          {t.translating}
        </span>
      )}

      {!isLoading && isAutoTranslated && (
        <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
          <Sparkles size={14} />
          {t.autoTranslated}
        </span>
      )}
      {!isLoading && error && (
        <button type="button" onClick={onRetry} className="ml-auto text-xs font-semibold text-red-600 hover:text-red-700">
          {t.noTranslation} {ui("· Retry")} </button>
      )}
    </div>
  );
}
