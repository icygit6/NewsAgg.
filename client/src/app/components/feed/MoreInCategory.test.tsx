import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { NewsArticle } from '../../types/article';

beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }));
afterEach(() => vi.unstubAllGlobals());

const state = vi.hoisted(() => ({ category: 'all', select: vi.fn() }));
vi.mock('../../contexts/AppContext', () => ({ useApp: () => ({
  isDark: false, language: 'en', selectedCategory: state.category, setSelectedCategory: state.select,
}) }));
vi.mock('../../i18n/uiText', () => ({ useUiText: () => (text: string) => text }));
import { MoreInCategory } from './MoreInCategory';

const articles = [{ id: 'sport-1', topic: 'Sport', title: 'A sports headline',
  url: 'https://example.com/sport', publishedAt: '2026-10-24T00:00:00Z', source: { name: 'BBC' },
}] as NewsArticle[];
afterEach(() => { cleanup(); state.category = 'all'; state.select.mockClear(); });

it('hides the category action when already viewing that category, keeping article links', () => {
  state.category = 'sport';
  render(<MemoryRouter><MoreInCategory articles={articles} /></MemoryRouter>);
  expect(screen.queryByRole('button', { name: 'See all' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /A sports headline/ })).toHaveAttribute('href', '/article/sport-1');
});

it.each(['all', 'business'])('keeps the category action when viewing %s', category => {
  state.category = category;
  render(<MemoryRouter><MoreInCategory articles={articles} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'See all' }));
  expect(state.select).toHaveBeenCalledWith('sport');
});

it.each([[211, 3], [140, 2], [290, 4]])('fits headlines into %ipx without expanding the card', (height, expected) => {
  const clientHeight = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(height);
  const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ height: 67 } as DOMRect);
  const { container } = render(<MemoryRouter><MoreInCategory articles={Array.from({ length: 4 }, (_, index) => ({ ...articles[0], id: 'sport-' + index }))} /></MemoryRouter>);
  expect(container.querySelectorAll('li:not([aria-hidden])')).toHaveLength(expected);
  expect(screen.getByTestId('more-in-category')).toHaveClass('[contain:size]');
  clientHeight.mockRestore();
  rect.mockRestore();
});
