import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { DrawerSkeleton, FeedSkeleton, HERO_HEIGHT, HeroSkeleton, ListSkeleton, PanelSkeleton, RailSkeleton } from './ContentSkeleton';
import { ImageWithFallback } from '../utils/ImageWithFallback';

beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

const loaders = [
  ['FeedSkeleton', () => <FeedSkeleton count={2} hero />],
  ['ListSkeleton', () => <ListSkeleton />],
  ['PanelSkeleton', () => <PanelSkeleton />],
  ['RailSkeleton', () => <RailSkeleton />],
  ['DrawerSkeleton', () => <DrawerSkeleton />],
] as const;

it.each(loaders)('%s is announced once as busy and shimmers with the shared primitive', (_name, view) => {
  const { container } = render(view());
  const status = screen.getAllByRole('status');
  expect(status).toHaveLength(1);
  expect(status[0]).toHaveAttribute('aria-busy', 'true');
  expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(3);
  // One shimmer for everything: the old opacity pulse must not come back in a loader.
  expect(container.querySelector('[class*="animate-pulse"]')).toBeNull();
});

it('the rail skeleton mirrors the real rail: sentiment, Live View, Trending, Reporting authors', () => {
  const { container } = render(<RailSkeleton />);
  // Four panels with the analytics-panel surface (opaque, bordered, no shadow).
  expect(container.querySelectorAll('.rounded-2xl.border.bg-white').length).toBe(4);
});

it('the hero skeleton has the carousel height, so nothing jumps when it loads', () => {
  const { container } = render(<HeroSkeleton />);
  for (const token of HERO_HEIGHT.split(' ')) expect(container.firstElementChild).toHaveClass(token);
});

it('the drawer skeleton carries the canonical logo', () => {
  render(<DrawerSkeleton label="Loading account" />);
  const logo = document.querySelector('img') as HTMLImageElement;
  expect(logo.getAttribute('src')).toBe('/logo-mark-128.png?v=brand-20261031');
  expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading account');
});

it('a story without a photo gets the canonical mark, not a second drawing', () => {
  const { container } = render(<ImageWithFallback src={undefined} alt="" className="h-20 w-24" />);
  const marks = [...container.querySelectorAll('img')].map((img) => img.getAttribute('src'));
  expect(marks).toEqual(['/logo-mark-128.png?v=brand-20261031']);
});

// Guard: only BrandLogo may name a logo file. A second asset or an emoji standing in for the
// brand is how the lookalike marks crept in.
const sources = import.meta.glob('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

it('no component references a logo file except BrandLogo', () => {
  const offenders = Object.entries(sources)
    .filter(([file]) => !/\.test\./.test(file) && !file.endsWith('/ui/BrandLogo.tsx') && !file.endsWith('/SeoMetadata.tsx'))
    .filter(([, text]) => /["'`]\/(logo-mark|favicon|icon-)[^"'`]*\.(png|svg)/.test(text))
    .map(([file]) => file);
  expect(offenders).toEqual([]);
});

it('news cards do not repeat the topic in a sparkle AI-label badge', () => {
  const card = sources['/src/app/components/NewsCard.tsx'];
  expect(card).not.toContain('article.aiTopLabel');
  expect(card).not.toContain('Sparkles');
  expect(card).toContain('{ui(article.topic)}');
});

it('the 404 page uses the drawn empty-state scene rather than an emoji', () => {
  expect(sources['/src/app/pages/NotFound.tsx']).not.toContain('📰');
  expect(sources['/src/app/pages/NotFound.tsx']).toContain('FeedState');
});
