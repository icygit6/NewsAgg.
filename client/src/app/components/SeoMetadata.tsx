import { useEffect } from 'react';
import type { NewsArticle } from '../types/article';

const DEFAULT_TITLE = 'NewsAgg';
const DEFAULT_DESCRIPTION = 'Latest Breaking News and Personalized Headlines - NewsAgg';

function upsertMeta(selector: string, attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

export function SeoMetadata({ article }: { article: NewsArticle | null }) {
  useEffect(() => {
    if (!article) return;

    const pageUrl = `${window.location.origin}${window.location.pathname}`;
    const description = (article.description || article.aiSummary || DEFAULT_DESCRIPTION).slice(0, 200);
    const image = article.urlToImage || article.images[0]?.url || `${window.location.origin}/og-image.png`;
    document.title = `${article.title} | NewsAgg`;

    upsertMeta('meta[name="description"]', 'name', 'description', description);
    upsertMeta('meta[property="og:type"]', 'property', 'og:type', 'article');
    upsertMeta('meta[property="og:title"]', 'property', 'og:title', article.title);
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', description);
    upsertMeta('meta[property="og:url"]', 'property', 'og:url', pageUrl);
    upsertMeta('meta[property="og:image"]', 'property', 'og:image', image);
    upsertMeta('meta[property="article:published_time"]', 'property', 'article:published_time', article.publishedAt);
    upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', article.title);
    upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
    upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image', image);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = pageUrl;

    const jsonLd = document.createElement('script');
    jsonLd.type = 'application/ld+json';
    jsonLd.dataset.newsaggSeo = 'article';
    jsonLd.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: article.title,
      description,
      image: [image],
      datePublished: article.publishedAt,
      ...(article.modifiedAt ? { dateModified: article.modifiedAt } : {}),
      ...(article.author ? { author: { '@type': 'Person', name: article.author } } : {}),
      publisher: { '@type': 'Organization', name: 'NewsAgg', logo: { '@type': 'ImageObject', url: `${window.location.origin}/logo-mark.png` } },
      mainEntityOfPage: pageUrl,
      isBasedOn: article.url,
    });
    document.head.appendChild(jsonLd);

    return () => {
      document.title = DEFAULT_TITLE;
      upsertMeta('meta[name="description"]', 'name', 'description', DEFAULT_DESCRIPTION);
      upsertMeta('meta[property="og:type"]', 'property', 'og:type', 'website');
      upsertMeta('meta[property="og:title"]', 'property', 'og:title', 'NewsAgg — Breaking news, personalized');
      upsertMeta('meta[property="og:description"]', 'property', 'og:description', DEFAULT_DESCRIPTION);
      upsertMeta('meta[property="og:image"]', 'property', 'og:image', '/og-image.png?v=20260910-baseline');
      upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', 'NewsAgg — Breaking news, personalized');
      upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', DEFAULT_DESCRIPTION);
      upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image', '/og-image.png?v=20260910-baseline');
      document.head.querySelector('meta[property="og:url"]')?.remove();
      document.head.querySelector('meta[property="article:published_time"]')?.remove();
      document.head.querySelector('link[rel="canonical"]')?.remove();
      jsonLd.remove();
    };
  }, [article]);

  return null;
}
