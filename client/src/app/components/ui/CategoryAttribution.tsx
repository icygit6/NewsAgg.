import type { NewsArticle } from '../../types/article';

export function categoryAttribution(article: NewsArticle) {
  if (article.classificationSource === 'model') {
    return {
      label: 'AI category',
      explanation: 'Category assigned using a topic classification model. Its score measures topic fit, not factual accuracy or news quality.',
    };
  }
  return {
    label: 'Publisher category',
    explanation: 'Category mapped from the publisher feed or section. No AI topic confidence was measured.',
  };
}

export function CategoryAttribution({ article }: { article: NewsArticle }) {
  const { label, explanation } = categoryAttribution(article);
  return <span title={explanation} className="text-xs text-slate-500 dark:text-slate-400">{label}</span>;
}
