import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { LiveView } from './LiveView';
import { fadeMask } from '../../hooks/useScrollFade';
import type { NewsArticle } from '../../types/article';

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ t: { noResults: 'No results', positive: 'Positive', neutral: 'Neutral', negative: 'Negative' }, isDark: false }),
}));
vi.mock('../../hooks/useTitleTranslations', () => ({ useTitleTranslations: (articles: unknown) => articles }));

beforeAll(() => {
  class Observer { observe() {} disconnect() {} unobserve() {} }
  vi.stubGlobal('ResizeObserver', Observer);
});
afterEach(cleanup);

const article = (n: number, title: string): NewsArticle => ({
  url: `https://example.com/a${n}`, title, topic: 'Politics', publishedAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
  sentiment: { type: 'neutral' },
} as unknown as NewsArticle);

const view = (articles: NewsArticle[]) => render(<MemoryRouter><LiveView articles={articles} categoryLabel="All Categories" /></MemoryRouter>);

// Realistic worst case for this panel: long Traditional Chinese headlines and an unbroken URL-like word.
const LONG = '逾8000萬請「美語老師」國防部首證實美軍觀察「漢光」演習，立法院朝野立委要求公開完整名單與經費細節並限期提出書面報告說明';
const UNBROKEN = 'https://news.example.com/2026/10/21/an-extremely-long-canonical-article-slug-with-no-break-opportunities';

it('has no visible scrollbar but stays scrollable and keyboard-reachable without trapping parent scroll', () => {
  view([...Array(8)].map((_, n) => article(n, LONG)));
  const list = screen.getByRole('region', { name: 'Live view' });
  expect(list).toHaveClass('no-scrollbar', 'overflow-x-auto');
  expect(list).not.toHaveClass('overscroll-contain');
  expect(list).toHaveAttribute('tabindex', '0');
  expect(list.className).not.toMatch(/\bpr-1\b/); // the gutter that used to sit beside the scrollbar
});

it('says "1 article", not "1 articles"', () => {
  view([article(1, 'One story')]);
  expect(screen.getByText('1 article')).toBeInTheDocument();
  cleanup();
  view([...Array(8)].map((_, n) => article(n, 'Story')));
  expect(screen.getByText('8 articles')).toBeInTheDocument();
});

it('an empty list says so and still renders a quiet panel', () => {
  view([]);
  expect(screen.getByText('No results')).toBeInTheDocument();
  expect(screen.getByText('0 articles')).toBeInTheDocument();
});

it('long headlines are clamped but readable in full on hover, and unbroken words wrap', () => {
  view([article(1, LONG), article(2, UNBROKEN)]);
  const first = screen.getByText(LONG);
  expect(first).toHaveClass('line-clamp-2', 'break-words');
  expect(first).toHaveAttribute('title', LONG);
  expect(screen.getByText(UNBROKEN)).toHaveClass('break-words');
});

it('fades only the edges that still have content beyond them', () => {
  expect(fadeMask(false, false)).toEqual({});
  expect(fadeMask(false, true).maskImage).toContain('transparent 100%');
  expect(fadeMask(false, true).maskImage).not.toContain('transparent 0');
  expect(fadeMask(true, false).maskImage).toContain('transparent 0');
  expect(fadeMask(true, true).maskImage).toMatch(/transparent 0.*transparent 100%/);
});

it('pages the full feed in groups of ten without play or pause controls', () => {
  const { container } = view(Array.from({ length: 23 }, (_, n) => article(n, 'Story ' + n)));
  const pages = container.querySelectorAll('[data-page]');
  expect(pages).toHaveLength(3);
  expect(Array.from(pages).map(page => page.querySelectorAll('a').length)).toEqual([10, 10, 3]);
  expect(pages[1]).toHaveAttribute('inert');
  expect(screen.getByText('1–10 / 23')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /pause|resume|play/i })).not.toBeInTheDocument();
});
