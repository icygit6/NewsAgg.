import { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import type { NewsArticle } from '../types/article';
import type { ReadingLanguage } from '../components/ui/LanguageSwitcher';
import {
  fetchArticleTranslation,
  LANGUAGE_API_CODE,
  type ApiLang,
  type ArticleTranslation,
} from '../services/translateService';

export interface UseTranslateResult {
  title: string;
  description: string | null;
  content: string | null;
  aiSummary: string | null;
  isLoading: boolean;
  isAutoTranslated: boolean;
  error: string | null;
  retry: () => void;
  selectedLanguage: ReadingLanguage;
  setSelectedLanguage: (language: ReadingLanguage) => void;
}

// Module-level cache so revisiting an article in a language already fetched is
// instant and never re-hits the network.
const cache = new Map<string, ArticleTranslation>();

// Best-effort: is the article already written in the target language? Mirrors
// the backend's normalizeStoredLang so we can skip a needless request.
export function articleMatchesLang(article: { language?: string | null; source?: { language?: string | null } }, target: ApiLang): boolean {
  const l = (article.language || article.source?.language || '').trim().toLowerCase();
  if (!l) return false;
  if (target === 'en') return l === 'en' || l.startsWith('en-');
  if (target === 'id') return l === 'id' || l.startsWith('id-');
  if (target === 'zh-TW') return l === 'zh-tw' || l === 'zh_hant' || l === 'zh-hant';
  if (target === 'zh-CN') return l === 'zh-cn' || l === 'zh' || l === 'zh-hans' || l === 'zh_hans';
  return false;
}

/**
 * Returns the article's effective (possibly translated) text fields.
 * Defaults to the site's news language: the untranslated original in Multi
 * mode, otherwise the interface language. A pill override belongs only to this
 * article; navigating to another article or changing the site choice resets it.
 */
export function useTranslate(article: NewsArticle | null): UseTranslateResult {
  const { language, newsMode } = useApp();
  const siteChoice: ReadingLanguage = newsMode === 'original' ? 'original' : language;
  const [selection, setSelection] = useState<{ articleId: string; siteChoice: ReadingLanguage; language: ReadingLanguage } | null>(null);
  const selectedLanguage = selection?.articleId === article?.id && selection?.siteChoice === siteChoice ? selection.language : siteChoice;
  const target: ApiLang | null = selectedLanguage === 'original' ? null : LANGUAGE_API_CODE[selectedLanguage];
  useEffect(() => setSelection(null), [article?.id, siteChoice]);

  const [override, setOverride] = useState<ArticleTranslation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setError(null);

    if (!article || !target || articleMatchesLang(article, target)) {
      setOverride(null);
      setIsLoading(false);
      return;
    }

    const key = `${article.id}:${article.contentHash || article.modifiedAt || article.scrapedAt}:${target}`;
    const cached = cache.get(key);
    if (cached) {
      setOverride(cached);
      setIsLoading(false);
      return;
    }

    let active = true;
    setOverride(null);
    setIsLoading(true);
    fetchArticleTranslation(article.id, target)
      .then((result) => {
        if (!active) return;
        if (result && result.autoTranslated) {
          cache.set(key, result);
          if (cache.size > 100) cache.delete(cache.keys().next().value!);
          setOverride(result);
        } else {
          setError('translation_failed');
          setOverride(null);
        }
      })
      .catch(() => { if (active) { setError('translation_failed'); setOverride(null); } })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [article, target, attempt]);

  const retry = () => setAttempt((value) => value + 1);
  const controls = {
    selectedLanguage,
    setSelectedLanguage: (next: ReadingLanguage) => {
      if (article) setSelection({ articleId: article.id, siteChoice, language: next });
    },
  };

  if (target && override?.autoTranslated && override.articleId === article?.id && override.lang === target && article && !articleMatchesLang(article, target)) {
    return {
      title: override.title ?? article?.title ?? '',
      description: override.description ?? article?.description ?? null,
      content: override.content ?? article?.content ?? null,
      aiSummary: override.aiSummary ?? article?.aiSummary ?? null,
      isLoading,
      isAutoTranslated: true,
      error,
      retry,
      ...controls,
    };
  }

  return {
    title: article?.title ?? '',
    description: article?.description ?? null,
    content: article?.content ?? null,
    aiSummary: article?.aiSummary ?? null,
    isLoading,
    isAutoTranslated: false,
    error,
    retry,
    ...controls,
  };
}
