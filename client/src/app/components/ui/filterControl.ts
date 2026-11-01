import type { SentimentType } from '../../types/sentiment';

/** The filters the shared filter panel edits: the home feed's, or a page's own. */
export interface FilterControl {
  categories: string[];
  setCategories: (value: string[]) => void;
  sources: string[];
  setSources: (value: string[]) => void;
  sentiments: SentimentType[];
  setSentiments: (value: SentimentType[]) => void;
  sort: string;
  setSort: (value: string) => void;
  sortOptions: Array<{ value: string; label: string }>;
  defaultSort: string;
}

/** How many filters differ from their defaults (the badge on the filter button). */
export function filterCount(c: Pick<FilterControl, 'categories' | 'sources' | 'sentiments' | 'sort' | 'defaultSort'>) {
  return c.categories.length + c.sources.length + c.sentiments.length + (c.sort !== c.defaultSort ? 1 : 0);
}
