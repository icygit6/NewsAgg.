import { createContext, useContext, useMemo } from 'react';
import { translations, type Language } from './translations';
import traditional from './ui.zhTW.json';

export const UiLocaleContext = createContext<Language>('en');
export function useUiLocale() {
  return useContext(UiLocaleContext) === 'zhTW' ? 'zh-TW' : 'en-US';
}
export function translateUi(text: string, language: Language): string {
  if (language === 'en') return text;
  if (language === 'zhTW' && text in traditional) return traditional[text as keyof typeof traditional];
  if (language === 'zhTW') {
    const minutes = text.match(/^(\d+) min( read)?$/);
    if (minutes) return `${minutes[1]} 分鐘${minutes[2] ? '閱讀' : ''}`;
    const ago = text.match(/^(\d+)([mhd]) ago$/);
    if (ago) return `${ago[1]} ${ { m:'分鐘', h:'小時', d:'天' }[ago[2]] }前`;
  }
  const key = (Object.keys(translations.en) as Array<keyof typeof translations.en>).find(key => translations.en[key] === text);
  // Some entries (chat starter questions) are string lists, not copy this
  // helper can substitute; fall back to the original text for those.
  const translated = key ? translations[language][key] : text;
  return typeof translated === 'string' ? translated : text;
}
/** Punctuation that joins translated pieces: full-width in Chinese, ASCII with spacing in English. */
export function useUiPunctuation() {
  const zh = useContext(UiLocaleContext) === 'zhTW';
  return useMemo(() => (zh
    ? { colon: '：', open: '（', close: '）', stop: '。' }
    : { colon: ': ', open: ' (', close: ')', stop: '. ' }), [zh]);
}
/** Translate curated interface copy only. Never apply this to publisher/user content. */
export function useUiText() {
  const language = useContext(UiLocaleContext);
  return useMemo(() => (text: string) => translateUi(text, language), [language]);
}
