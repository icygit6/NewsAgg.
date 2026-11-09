/** Feature flag: the posts/quotes social feed (F7). Backend + UI landed —
 * composer, /posts page, nav tabs and the interleaved Pulse rail are live. */
export const POSTS_ENABLED = true;

export const CATEGORIES = [
  'sport',
  'health',
  'business',
  'world',
  'politics',
  'lifestyle',
  'science',
  'climate',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  sport: 'Sport',
  health: 'Health',
  business: 'Business',
  world: 'World',
  politics: 'Politics',
  lifestyle: 'Lifestyle',
  science: 'Science',
  climate: 'Climate',
};

export const CATEGORY_TOPIC_MAP = {
  sport: 'Sport',
  health: 'Health',
  business: 'Business',
  world: 'World',
  politics: 'Politics',
  lifestyle: 'Lifestyle',
  science: 'Science',
  climate: 'Climate',
} as const;

export type CategoryTopic = (typeof CATEGORY_TOPIC_MAP)[Category];

export const TOPIC_TO_CATEGORY: Record<CategoryTopic, Category> = {
  Sport: 'sport',
  Health: 'health',
  Business: 'business',
  World: 'world',
  Politics: 'politics',
  Lifestyle: 'lifestyle',
  Science: 'science',
  Climate: 'climate',
};

/** One colour per category, used everywhere the category appears: badge, active chip, card
 * edge, dot, hover and charts. Eight distinct hues; none is red (negative sentiment) or
 * yellow (neutral sentiment). Each carries white 12px text at 4.5:1 or better (WCAG AA). */
export const CATEGORY_ACCENT: Record<Category, string> = {
  politics: '#1d4ed8',
  business: '#6d28d9',
  lifestyle: '#c026d3',
  health: '#be185d',
  sport: '#c2410c',
  climate: '#15803d',
  world: '#0f766e',
  science: '#0369a1',
};

/** The same hue lifted for text on dark surfaces (hover titles, links). */
export const CATEGORY_ACCENT_LIGHT: Record<Category, string> = {
  politics: '#93c5fd',
  business: '#c4b5fd',
  lifestyle: '#f0abfc',
  health: '#f9a8d4',
  sport: '#fdba74',
  climate: '#86efac',
  world: '#5eead4',
  science: '#7dd3fc',
};

// Literal classes (Tailwind only generates what it can read in source).
export const CATEGORY_BADGE_CLASS: Record<Category, string> = {
  politics: 'bg-[#1d4ed8] text-white',
  business: 'bg-[#6d28d9] text-white',
  lifestyle: 'bg-[#c026d3] text-white',
  health: 'bg-[#be185d] text-white',
  sport: 'bg-[#c2410c] text-white',
  climate: 'bg-[#15803d] text-white',
  world: 'bg-[#0f766e] text-white',
  science: 'bg-[#0369a1] text-white',
};

/** Badge colours for a post category label, matching the badge on a published post.
 * "General" is not a news category, so it takes the neutral fallback the news cards use. */
export function postCategoryBadgeClass(label: string): string {
  const category = CATEGORIES.find(c => CATEGORY_LABELS[c] === label);
  return category ? CATEGORY_BADGE_CLASS[category] : 'bg-slate-600 text-white';
}

/** CSS variables for a category, read by `hover:text-[var(--cat)]` and friends. */
export function categoryVars(category: Category | undefined): Record<string, string> {
  if (!category) return {};
  return { '--cat': CATEGORY_ACCENT[category], '--cat-light': CATEGORY_ACCENT_LIGHT[category] };
}

/** Text in the category colour, readable in both modes. */
export const CATEGORY_TEXT = 'text-[var(--cat)] dark:text-[var(--cat-light)]';
export const CATEGORY_HOVER_TEXT = 'hover:text-[var(--cat)] dark:hover:text-[var(--cat-light)]';
export const CATEGORY_GROUP_HOVER_TEXT = 'group-hover:text-[var(--cat)] dark:group-hover:text-[var(--cat-light)]';

export const TOPIC_BADGE_CLASS: Record<CategoryTopic, string> = {
  Sport: CATEGORY_BADGE_CLASS.sport,
  Health: CATEGORY_BADGE_CLASS.health,
  Business: CATEGORY_BADGE_CLASS.business,
  World: CATEGORY_BADGE_CLASS.world,
  Politics: CATEGORY_BADGE_CLASS.politics,
  Lifestyle: CATEGORY_BADGE_CLASS.lifestyle,
  Science: CATEGORY_BADGE_CLASS.science,
  Climate: CATEGORY_BADGE_CLASS.climate,
};

// ─── Sources ────────────────────────────────────────────────────────────────
// Stable source identifiers used by the source filter (AppContext.selectedSources)
// and the scraper. `matchers` are lowercase substrings tested against an article's
// source id / name / domain, so filtering keeps working regardless of how the live
// DB labels each source.

export interface SourceOption {
  id: string; // stable key stored in selectedSources, e.g. 'cnn'
  name: string; // display label
  domain: string; // canonical domain — also used to fetch a favicon logo
  matchers: string[];
}

/** Cache key for every generated brand image (icons, logo, social card). Bump it whenever
 * scripts/generate-brand-assets.py runs; brandAssets.test.ts checks index.html, the manifest,
 * the research page and the daily email use the same one. */
export const BRAND_ASSET_VERSION = 'brand-20261031';

export const SOURCES: SourceOption[] = [
  {
    id: 'aljazeera',
    name: 'Al Jazeera',
    domain: 'aljazeera.com',
    matchers: ['aljazeera', 'al jazeera', 'jazeera'],
  },
  { id: 'bbc', name: 'BBC', domain: 'bbc.com', matchers: ['bbc'] },
  { id: 'cnn', name: 'CNN', domain: 'edition.cnn.com', matchers: ['cnn'] },
  { id: 'yahoo_tw', name: 'Yahoo Taiwan', domain: 'tw.news.yahoo.com', matchers: ['yahoo'] },
];

/** Favicon-based logo for a source domain (Google's public favicon service). */
export const sourceLogoUrl = (domain: string): string =>
  `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

/**
 * Resolve an article's source to one of the known SOURCES ids, or null if it
 * matches none. Tests id, name and domain so it works regardless of how the live
 * DB labels the source.
 */
export const matchSourceId = (
  source: { id?: string | null; name?: string | null; domain?: string | null }
): string | null => {
  const haystack = [source.id, source.name, source.domain]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (!haystack) return null;
  return SOURCES.find((s) => s.matchers.some((m) => haystack.includes(m)))?.id ?? null;
};

export const COUNTRIES = [
  { code: 'us', name: 'United States' },
  { code: 'id', name: 'Indonesia' },
  { code: 'gb', name: 'United Kingdom' },
  { code: 'au', name: 'Australia' },
  { code: 'jp', name: 'Japan' },
  { code: 'cn', name: 'China' },
  { code: 'de', name: 'Germany' },
  { code: 'fr', name: 'France' },
  { code: 'in', name: 'India' },
  { code: 'br', name: 'Brazil' },
] as const;

/** Country page → source ids served from that country. Codes without an entry
 * have no scraped source yet and render an empty state. */
export const COUNTRY_SOURCE_MAP: Record<string, string[]> = {
  us: ['cnn'],
  gb: ['bbc'],
  qa: ['aljazeera'],
  tw: ['yahoo_tw'],
};
