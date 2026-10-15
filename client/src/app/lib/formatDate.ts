import type { Language } from '../i18n/translations';

const LOCALE: Record<Language, string> = { en: 'en-GB', id: 'id-ID', zhCN: 'zh-CN', zhTW: 'zh-TW' };

/**
 * Publication dates in the interface language instead of the browser's
 * default (which rendered US-style 10/13/2026 for a Taiwanese audience):
 * "13 Oct 2026" in English, "2026/10/13" in Chinese.
 */
export function formatNewsDate(value: string, language: Language, withTime = false): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const chinese = language === 'zhTW' || language === 'zhCN';
  return new Intl.DateTimeFormat(LOCALE[language], {
    year: 'numeric',
    month: chinese ? '2-digit' : 'short',
    day: chinese ? '2-digit' : 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
    timeZone: 'Asia/Taipei',
  }).format(date);
}
