import type { Language } from '../i18n/translations';

const BASE_URL = import.meta.env.VITE_API_URL || '';

// API-side language codes (what the backend /translate endpoint expects).
export type ApiLang = 'en' | 'id' | 'zh-CN' | 'zh-TW';

// Maps the client's Language union onto the backend's ApiLang codes.
export const LANGUAGE_API_CODE: Record<Language, ApiLang> = {
  en: 'en',
  zhTW: 'zh-TW',
};

export interface ArticleTranslation {
  articleId: string;
  lang: ApiLang;
  title: string | null;
  description: string | null;
  content: string | null;
  aiSummary: string | null;
  cached: boolean;
  autoTranslated: boolean;
  provider: string;
}

export type PreviewTranslation = Pick<ArticleTranslation, 'articleId' | 'title' | 'description' | 'aiSummary' | 'provider'>;

export async function fetchPreviewTranslations(articleIds: string[], lang: ApiLang): Promise<Record<string, PreviewTranslation>> {
  if (articleIds.length === 0) return {};
  const res = await fetch(`${BASE_URL}/api/articles/translate-previews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ articleIds: articleIds.slice(0, 20), lang }),
  });
  if (!res.ok) throw new Error('preview_translation_failed');
  const json = await res.json();
  const rows = Array.isArray(json?.data) ? json.data : [];
  return Object.fromEntries(rows.flatMap((row: unknown) => {
    if (!row || typeof row !== 'object' || !('id' in row) || typeof row.id !== 'string' || row.id.length === 0) {
      return [];
    }
    const value = row as Record<string, unknown>;
    const translation: PreviewTranslation = {
      articleId: row.id,
      title: typeof value.title === 'string' ? value.title : null,
      description: typeof value.description === 'string' ? value.description : null,
      aiSummary: typeof value.aiSummary === 'string' ? value.aiSummary : null,
      provider: typeof value.provider === 'string' ? value.provider : 'none',
    };
    return [[row.id, translation]];
  }));
}

/**
 * Fetch a translation of the given article from the backend proxy.
 * The backend handles cache lookup, Gemini, and Lingva fallback — the
 * GEMINI_API_KEY never reaches the client. Returns null on any failure.
 */
export async function fetchArticleTranslation(
  articleId: string,
  lang: ApiLang
): Promise<ArticleTranslation | null> {
  try {
    const res = await fetch(
      `${BASE_URL}/api/articles/${encodeURIComponent(articleId)}/translate?lang=${encodeURIComponent(lang)}`
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json?.success && json.data ? (json.data as ArticleTranslation) : null;
  } catch {
    return null;
  }
}
