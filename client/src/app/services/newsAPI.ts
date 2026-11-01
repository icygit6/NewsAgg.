import { isEditorialKeyword } from '../lib/keywords';
import { cleanBBCPresentation } from '../lib/bbcPresentation';
import { CATEGORY_TOPIC_MAP, TOPIC_TO_CATEGORY } from '../constants';
import type {
  NewsTopic,
  NewsCategoryFilter,
  NewsEntities,
  NewsSource,
  NewsImage,
  NewsToxicity,
  NewsReadability,
  NewsOpenGraph,
  NewsArticle,
  LiveEngagementItem,
} from '../types/article';
import type { SentimentType, NewsSentimentProbabilities, NewsSentiment } from '../types/sentiment';
import type { RawNewsData } from '../types/api';

export const SUPPORTED_TOPICS = Object.values(CATEGORY_TOPIC_MAP) as NewsTopic[];

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_URL || '';
const API_BASE_URL = `${BASE_URL}/api/news-from-db`;

// ─── Internal maps ────────────────────────────────────────────────────────────

const SENTIMENT_TYPES: SentimentType[] = ['positive', 'neutral', 'negative'];
const TOPIC_VALUES = Object.keys(TOPIC_TO_CATEGORY) as NewsTopic[];

// ─── Primitive helpers (unchanged) ───────────────────────────────────────────

const clampUnit = (value: number): number => Math.max(0, Math.min(1, value));
const clampSignedUnit = (value: number): number => Math.max(-1, Math.min(1, value));

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

// Parses DB numerics that may arrive as strings. null/undefined/'' are
// "missing" — NOT 0: `Number(null)` is 0 and `0 || fallback` takes the
// fallback, the classic falsy-zero traps this helper exists to avoid.
const numOrNull = (value: unknown): number | null => {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const asBoolean = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null);

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map(asString).filter((item): item is string => item !== null);
};

const asNumberRecord = (value: unknown): Record<string, number> => {
  const raw = asRecord(value);
  return Object.fromEntries(
    Object.entries(raw)
      .map(([key, item]) => [key, asNumber(item)])
      .filter((entry): entry is [string, number] => entry[1] !== null),
  );
};

const pickString = (...values: unknown[]): string | null => {
  for (const value of values) {
    const parsed = asString(value);
    if (parsed !== null) return parsed;
  }
  return null;
};

const pickNumber = (...values: unknown[]): number | null => {
  for (const value of values) {
    const parsed = asNumber(value);
    if (parsed !== null) return parsed;
  }
  return null;
};

const pickBoolean = (...values: unknown[]): boolean | null => {
  for (const value of values) {
    const parsed = asBoolean(value);
    if (parsed !== null) return parsed;
  }
  return null;
};

// ─── Normalizers (unchanged) ─────────────────────────────────────────────────

const normalizeTopic = (topic: unknown): NewsTopic | null => {
  const rawTopic = asString(topic);
  if (!rawTopic) return null;
  return TOPIC_VALUES.find((value) => value.toLowerCase() === rawTopic.toLowerCase()) ?? null;
};

const normalizeSentiment = (value: unknown): NewsSentiment => {
  const raw = asRecord(value);
  const rawType = pickString(raw.type)?.toLowerCase() ?? 'neutral';
  const type: SentimentType = SENTIMENT_TYPES.includes(rawType as SentimentType)
    ? (rawType as SentimentType)
    : 'neutral';
  const score = clampUnit(pickNumber(raw.score) ?? 0);
  const comparative = clampSignedUnit(pickNumber(raw.comparative) ?? 0);
  const rawProbabilities = asRecord(raw.probabilities);
  let probabilities: NewsSentimentProbabilities = {
    positive: clampUnit(pickNumber(rawProbabilities.positive) ?? 0),
    neutral: clampUnit(pickNumber(rawProbabilities.neutral) ?? 0),
    negative: clampUnit(pickNumber(rawProbabilities.negative) ?? 0),
  };
  const total = probabilities.positive + probabilities.neutral + probabilities.negative;
  if (total > 0) {
    probabilities = {
      positive: probabilities.positive / total,
      neutral: probabilities.neutral / total,
      negative: probabilities.negative / total,
    };
  } else if (type === 'positive') {
    probabilities = { positive: score, neutral: 1 - score, negative: 0 };
  } else if (type === 'negative') {
    probabilities = { positive: 0, neutral: 1 - score, negative: score };
  } else {
    const split = (1 - score) / 2;
    probabilities = { positive: split, neutral: score, negative: split };
  }
  const hasStoredProbabilities = raw.hasStoredProbabilities !== false && total > 0 &&
    ['positive', 'neutral', 'negative'].every(key => pickNumber(rawProbabilities[key]) !== null);
  return { type, score, comparative, probabilities, model: pickString(raw.model) ?? 'general', hasStoredProbabilities };
};

const normalizeSource = (value: unknown): NewsSource => {
  const raw = asRecord(value);
  return {
    // Always have an ID; fall back to a default so nothing downstream breaks
    id: pickString(raw.id, raw.source_id) ?? 'unknown',
    // Prefer name, otherwise the source_name from the DB join
    name: pickString(raw.name, raw.source_name, raw.id, raw.source_id) ?? 'Unknown Source',
    domain: pickString(raw.domain, raw.source_domain),
    country: pickString(raw.country, raw.source_country),
    // Default the language to en
    language: pickString(raw.language, raw.source_language) ?? 'en',
    logo: pickString(raw.logo, raw.logo_url, raw.source_logo),
  };
};

const normalizeImages = (value: unknown): NewsImage[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const raw = asRecord(item);
      const url = pickString(raw.url);
      if (!url) return null;
      return {
        url,
        alt: pickString(raw.alt),
        caption: pickString(raw.caption),
        isPrimary: pickBoolean(raw.is_primary, raw.isPrimary) ?? false,
      };
    })
    .filter((item): item is NewsImage => item !== null);
};

const normalizeEntities = (value: unknown): NewsEntities => {
  const raw = asRecord(value);
  return {
    persons: asStringArray(raw.persons),
    organizations: asStringArray(raw.organizations),
    locations: asStringArray(raw.locations),
    misc: asStringArray(raw.misc),
  };
};

const normalizeToxicity = (value: unknown): NewsToxicity => {
  const raw = asRecord(value);
  const score = numOrNull(raw.score);
  return {
    label: pickString(raw.label) ?? 'unknown',
    score: score === null ? null : clampUnit(score),
  };
};

const normalizeReadability = (value: unknown): NewsReadability => {
  const raw = asRecord(value);
  return {
    wordCount: Math.max(0, Math.round(pickNumber(raw.word_count, raw.wordCount) ?? 0)),
    readingTimeMin: Math.max(
      0,
      Math.round(pickNumber(raw.reading_time_min, raw.readingTimeMin) ?? 0),
    ),
    fleschScore: numOrNull(raw.flesch_score ?? raw.fleschScore),
    fleschKincaid: numOrNull(raw.flesch_kincaid ?? raw.fleschKincaid),
    smogIndex: numOrNull(raw.smog_index ?? raw.smogIndex),
  };
};

const normalizeOpenGraph = (value: unknown): NewsOpenGraph => {
  const raw = asRecord(value);
  return {
    title: pickString(raw.title),
    description: pickString(raw.description),
    siteName: pickString(raw.site_name, raw.siteName),
    locale: pickString(raw.locale),
    twitterCard: pickString(raw.twitter_card, raw.twitterCard),
    twitterSite: pickString(raw.twitter_site, raw.twitterSite),
  };
};

// Topics outside the 8 known categories are dropped (the type system and
// badge maps only cover those 8) — but loudly, once per unknown value, so a
// scraper topic change is visible instead of silently shrinking the feed.
const warnedTopics = new Set<string>();

const normalizeArticle = (article: unknown): NewsArticle | null => {
  const raw = asRecord(article);

  // 1. Topic
  const topic = normalizeTopic(raw.topic);
  if (!topic) {
    const rawTopic = asString(raw.topic) ?? '(empty)';
    if (!warnedTopics.has(rawTopic)) {
      warnedTopics.add(rawTopic);
      console.warn(`[newsAPI] dropping article(s) with unknown topic "${rawTopic}"`);
    }
    return null;
  }

  // 2. Flattened source: when raw.source is missing, rebuild it from source_id and friends
  const sourceInput = raw.source || {
    id: raw.source_id,
    name: raw.source_name || raw.source_id, // fallback
    domain: raw.source_domain,
    country: raw.source_country,
    language: raw.source_language,
    logo: raw.source_logo || raw.logo_url,
  };
  const source = normalizeSource(sourceInput);

  const sentimentInput = raw.sentiment || {
    hasStoredProbabilities: [raw.sentiment_pos, raw.sentiment_neu, raw.sentiment_neg].every(value => numOrNull(value) !== null),
    type: raw.sentiment_type || 'neutral',
    score: Number(raw.sentiment_score) || 0,
    comparative: Number(raw.sentiment_polarity) || 0,
    probabilities: {
      // A stored 0 is a real probability — only fall back when truly missing.
      positive: numOrNull(raw.sentiment_pos) ?? (raw.sentiment_type === 'positive' ? 1 : 0),
      neutral: numOrNull(raw.sentiment_neu) ?? (raw.sentiment_type === 'neutral' ? 1 : 0),
      negative: numOrNull(raw.sentiment_neg) ?? (raw.sentiment_type === 'negative' ? 1 : 0),
    },
    model: raw.sentiment_model || 'general',
  };

  const toxicityInput = raw.toxicity || {
    label: raw.toxicity_label,
    score: raw.toxicity_score,
  };

  const readabilityInput = raw.readability || {
    wordCount: Number(raw.word_count) || 0,
    readingTimeMin: Number(raw.reading_time_min) || 0,
    fleschScore: raw.flesch_score,
    fleschKincaid: raw.flesch_kincaid,
    smogIndex: raw.smog_index,
  };

  const canonicalUrl = pickString(raw.canonical_url, raw.canonicalUrl);
  const url = pickString(raw.url, canonicalUrl) ?? '';
  const publishedAt = pickString(raw.published_at, raw.publishedAt) ?? new Date(0).toISOString();
  const fallbackId = (canonicalUrl ?? url) || `${topic}-${publishedAt}`;

  return {
    id: pickString(raw.id) ?? encodeURIComponent(fallbackId),
    canonicalUrl,
    source,
    author: pickString(raw.author_name, raw.author) ?? 'Unknown',
    authorUrl: pickString(raw.author_url, raw.authorUrl),
    title: pickString(raw.title) ?? 'Untitled',
    description: pickString(raw.description),
    url,
    publishedAt,
    modifiedAt: pickString(raw.modified_at, raw.modifiedAt),
    scrapedAt: pickString(raw.scraped_at, raw.scrapedAt),
    content: pickString(raw.content),
    aiSummary: pickString(raw.ai_summary, raw.aiSummary),
    contentHash: pickString(raw.content_hash, raw.contentHash),
    summaryMethod: pickString(raw.summary_method, raw.summaryMethod),
    qualityVerified: raw.extraction_version === undefined ? undefined : raw.extraction_version === 'structured-v3' && raw.feed_eligible !== false,
    contentBlocks: Array.isArray(raw.content_blocks) ? raw.content_blocks.filter((b: any) => b && ['paragraph', 'heading', 'quote', 'caption', 'list'].includes(b.type) && (typeof b.text === 'string' || (Array.isArray(b.items) && b.items.every((s: unknown) => typeof s === 'string')))) : [],
    urlToImage: pickString(raw.url_to_image, raw.urlToImage),
    images: normalizeImages(raw.images),
    videoUrl: pickString(raw.video_url, raw.videoUrl),

    // Use the inputs assembled above
    sentiment: normalizeSentiment(sentimentInput),
    toxicity: normalizeToxicity(toxicityInput),
    readability: normalizeReadability(readabilityInput),

    topic,
    section: pickString(raw.section),
    metaTags: asStringArray(raw.meta_tags ?? raw.metaTags ?? []),
    ogType: pickString(raw.og_type, raw.ogType),
    language: pickString(raw.language, source.language),

    // Make sure arrays are never null
    keywords: asStringArray(raw.keywords ?? []).filter(isEditorialKeyword),
    entities: normalizeEntities(raw.entities || {}),
    relatedUrls: asStringArray(raw.related_urls ?? raw.relatedUrls ?? []),

    // numOrNull keeps a legitimate 0 relevance (the old truthiness check
    // turned 0 into "no data").
    aiConfidence:
      numOrNull(raw.ai_confidence) ??
      numOrNull(raw.ai_relevance) ??
      pickNumber(raw.aiConfidence, raw.aiRelevance) ??
      undefined,
    classificationSource:
      (pickString(raw.category_model, asRecord(raw.quality_metadata).category_model) || Object.keys(asNumberRecord(raw.ai_label_scores ?? raw.aiLabelScores ?? {})).length > 0)
        ? 'model'
        : 'source-section',
    aiTopLabel: pickString(raw.ai_top_label, raw.aiTopLabel),
    aiLabelScores: asNumberRecord(raw.ai_label_scores ?? raw.aiLabelScores ?? {}),

    isPremium: pickBoolean(raw.is_premium, raw.isPremium),
    isAccessibleFree: pickBoolean(raw.is_accessible_free, raw.isAccessibleFree),
    jsonldWordCount: pickNumber(raw.jsonld_word_count, raw.jsonldWordCount),

    // Open Graph (the DB may return it as og_data)
    og: normalizeOpenGraph(raw.og || raw.og_data),
  };
};

// ─── Stable hash (unchanged) ─────────────────────────────────────────────────

// ─── Public API ───────────────────────────────────────────────────────────────
// All reads go through the paginated endpoint or the stats endpoints; the old
// full-dataset in-memory store (and every helper that consumed it) is gone.

export const getArticleId = (article: Pick<NewsArticle, 'id' | 'url' | 'title'>): string =>
  article.id || encodeURIComponent(article.url || article.title);

// ─── Paginated API (React Query data layer) ──────────────────────────────────
// Server-side filtering/paging via GET /api/news-from-db's additive mode with
// fields=summary — a fraction of the legacy 400-article payload.

export interface ArticlesPageParams {
  category?: NewsCategoryFilter | string;
  sources?: string[];
  sentiment?: string;
  q?: string;
  sort?: ArticleSort;
  sinceHours?: number;
  pageSize?: number;
}

export type ArticleSort = 'top' | 'latest' | 'oldest' | 'rank';

export interface ArticlesPage {
  articles: NewsArticle[];
  totalCount: number;
  page: number;
  pageSize: number;
  scrapedAt: string | null;
  categories: string[];
  aiModels: Record<string, string>;
}

export const fetchArticlesPage = async (
  params: ArticlesPageParams,
  page = 1,
): Promise<ArticlesPage> => {
  const pageSize = params.pageSize ?? 20;
  const sp = new URLSearchParams();
  sp.set('page', String(page));
  sp.set('pageSize', String(pageSize));
  sp.set('fields', 'summary');
  if (params.category && params.category !== 'all') sp.set('category', String(params.category));
  if (params.sources && params.sources.length > 0) sp.set('source', params.sources.join(','));
  if (params.sentiment && params.sentiment !== 'all') sp.set('sentiment', params.sentiment);
  if (params.q) sp.set('q', params.q);
  if (params.sort && params.sort !== 'latest') sp.set('sort', params.sort);
  if (params.sinceHours) sp.set('sinceHours', String(params.sinceHours));

  const res = await fetch(`${API_BASE_URL}?${sp.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  const raw = (await res.json()) as RawNewsData & {
    totalCount?: number;
    page?: number;
    pageSize?: number;
  };

  const articles = (raw.articles ?? [])
    .map(normalizeArticle)
    .map(article => article ? cleanBBCPresentation(article) : null)
    .filter((article): article is NewsArticle => article !== null);

  return {
    articles,
    totalCount: typeof raw.totalCount === 'number' ? raw.totalCount : articles.length,
    page: raw.page ?? page,
    pageSize: raw.pageSize ?? pageSize,
    scrapedAt: pickString(raw.scrapedAt),
    categories: asStringArray(raw.categories),
    aiModels: Object.fromEntries(
      Object.entries(asRecord(raw.aiModels)).map(([key, value]) => [key, String(value)]),
    ),
  };
};

/** Single article via GET /api/articles/:id (full fields). */
export const fetchArticleById = async (articleId: string): Promise<NewsArticle | null> => {
  const res = await fetch(`${BASE_URL}/api/articles/${encodeURIComponent(articleId)}`);
  if (!res.ok) {
    if (res.status === 400 || res.status === 404) return null;
    throw new Error(`HTTP ${res.status}`);
  }
  const json = await res.json();
  if (json?.success && json.data) {
    const article = normalizeArticle(json.data);
    return article ? cleanBBCPresentation(article) : null;
  }
  return null;
};

/** Engagement is unavailable until backed by measured events. Never fabricate counts. */
export const buildLiveEngagement = (
  _articles: NewsArticle[],
  _timestamp = Date.now(),
  _limit = 8,
): LiveEngagementItem[] => [];
