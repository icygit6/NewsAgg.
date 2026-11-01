import { useApp } from '../contexts/AppContext';
import type { Language, Translations } from '../i18n/translations';

export const TRANSLATION_PILLS: { code: Language; short: string; label: (t: Translations) => string }[] = [
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
