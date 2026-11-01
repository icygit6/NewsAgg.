import { useUiText } from '../../i18n/uiText';
import { Languages, Loader2, Sparkles } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import type { Language, Translations } from '../../i18n/translations';

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

const TRANSLATION_PILLS: { code: Language; short: string; label: (t: Translations) => string }[] = [
  { code: 'en', short: 'EN', label: (t) => t.english },
  { code: 'zhTW', short: '繁中', label: (t) => t.zhTraditional },
];

/**
 * The interface-language choice shared by every picker (EN / 繁中). Whether
 * news is translated is a separate on/off switch (TranslateNewsToggle); the
 * former three-way "Multi / EN / 繁中" picker mixed the two and confused readers.
 */
export function useInterfaceLanguage() {
  const { t, language, setLanguage } = useApp();
  const options = TRANSLATION_PILLS.map((pill) => ({ code: pill.code, short: pill.short, label: pill.label(t) }));
  const choose = (code: Language) => setLanguage(code);
  return { choice: language, options, choose, current: options.find((option) => option.code === language) ?? options[0] };
}

export function LanguageSwitcher({ isDark, isLoading = false, isAutoTranslated = false, error, onRetry, selectedLanguage, onSelectLanguage }: LanguageSwitcherProps) {
  const ui = useUiText();
  const { t } = useApp();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Language pills */}
      <div className={`inline-flex items-center gap-1 rounded-full p-1 border ${isDark ? 'border-slate-700 bg-slate-800/60' : 'border-gray-200 bg-white'}`}>
        <Languages size={14} className={`ml-1.5 ${isDark ? 'text-slate-400' : 'text-gray-400'}`} />
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
                  : isDark
                  ? 'text-slate-300 hover:bg-slate-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {pill.short}
            </button>
          );
        })}
      </div>

      {/* Loading spinner during first-time translate */}
      {isLoading && (
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
          <Loader2 size={13} className="animate-spin" />
          {t.translating}
        </span>
      )}

      {/* Auto-translated badge */}
      {!isLoading && isAutoTranslated && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
          <Sparkles size={11} />
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
