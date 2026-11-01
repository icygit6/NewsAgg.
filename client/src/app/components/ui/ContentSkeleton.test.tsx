import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router';
import { FeedSkeleton } from './ContentSkeleton';
import { RouteFallback } from '../RouteFallback';
afterEach(cleanup);
it('also renders safely before the router and runtime config are initialized', () => {
  render(<RouteFallback />);
  expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
});

it('matches the responsive feed and hides decorative blocks from assistive technology', () => {
  const { container } = render(<FeedSkeleton count={3} label="Loading stories" />);
  expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  expect(container.querySelector('[class*="lg:grid-cols-3"]')).not.toBeNull();
  expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(3);
  expect(container.querySelector('[class*="animate-pulse"]')).toBeNull();
});
it.each([['/insights', 'Loading insights'], ['/article/123', 'Loading article'], ['/profile', 'Loading content']])('uses the matching route fallback for %s', (path, label) => {
  render(<MemoryRouter initialEntries={[path]}><RouteFallback /></MemoryRouter>);
  expect(screen.getByRole('status')).toHaveAttribute('aria-label', label);
});

const newsGridSource = import.meta.glob('/src/app/components/NewsGrid.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
it('keeps the desktop news grid at three columns, matching its skeleton', () => {
  const source = Object.values(newsGridSource)[0];
  expect(source).toContain('lg:grid-cols-3');
  expect(source).toContain('grid-cols-2');
});

const articlePageSource = import.meta.glob('/src/app/pages/ArticlePage.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
it('uses the same proportional split for the article sentiment panel', () => {
  const source = Object.values(articlePageSource)[0];
  expect(source).toContain('lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]');
  expect(source).not.toContain('min-w-[300px] max-w-[560px]');
});
