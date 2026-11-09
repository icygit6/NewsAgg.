import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { SentimentChart } from './SentimentChart';
import { CATEGORY_LABELS } from '../../constants';
vi.mock('../../hooks/useTitleTranslations', () => ({ useTitleTranslations: <T,>(items: T[]) => items }));
vi.mock('../article/ArticleSentimentExplanation', () => ({ ArticleSentimentExplanation: () => null }));
const state = vi.hoisted(() => ({ error: false, loaded: false, category: 'business' }));
vi.mock('../../contexts/AppContext', () => ({ useApp: () => ({ isDark: false, selectedCategory: state.category, t: { loading: 'Loading...', fetchFailed: 'Could not load', sentimentDistribution: 'Sentiment', allCategories: 'All', positive: 'Positive', neutral: 'Neutral', negative: 'Negative', next: 'Next' } }) }));
const overview = vi.hoisted(() => vi.fn(() => ({ data: state.loaded ? { sentiments: { positive: 10, neutral: 5, negative: 0 }, byCategory: [
  { topic: 'Sport', sentiments: { positive: 10, neutral: 0, negative: 0 } },
  { topic: 'Health', sentiments: { positive: 0, neutral: 5, negative: 0 } },
] } : undefined, isPending: !state.loaded && !state.error, isError: state.error })));
vi.mock('../../hooks/useStats', () => ({ useStatsOverview: overview }));
afterEach(() => { cleanup(); state.error = false; state.loaded = false; state.category = 'business'; overview.mockClear(); });
it('shows progress instead of fabricated zero sentiment counts while loading', () => {
  render(<SentimentChart />);
  expect(screen.getAllByRole('status')).toHaveLength(1);
  expect(screen.queryByText('0 (0%)')).not.toBeInTheDocument();
});
it('shows errors instead of empty sentiment distributions when requests fail', () => {
  state.error = true;
  render(<SentimentChart />);
  expect(screen.getAllByRole('alert')).toHaveLength(1);
  expect(screen.queryByText('0 (0%)')).not.toBeInTheDocument();
});

it('rotates the donut from the same aggregate without a new request or loading gap', () => {
  window.matchMedia ??= ((query: string) => ({ matches: false, media: query, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() })) as unknown as typeof window.matchMedia;
  state.loaded = true; state.category = 'all';
  render(<SentimentChart />);
  expect(screen.getByRole('group', { name: 'Positive: 10 (100%), Neutral: 0 (0%), Negative: 0 (0%)' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next category' }));
  expect(screen.getByRole('group', { name: 'Positive: 0 (0%), Neutral: 5 (100%), Negative: 0 (0%)' })).toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(overview.mock.calls.every((args) => (args as unknown[])[0] === 'all')).toBe(true);
});

it('allows direct category navigation using grey dots without changing the feed filter', () => {
  state.loaded = true; state.category = 'all';
  render(<SentimentChart />);
  const health = screen.getByRole('button', { name: 'Health' });
  fireEvent.click(health);
  expect(health).toHaveAttribute('aria-current', 'true');
  expect(screen.getByRole('group', { name: 'Positive: 0 (0%), Neutral: 5 (100%), Negative: 0 (0%)' })).toBeInTheDocument();
  expect(state.category).toBe('all');
  // The dots stay grey rather than taking each category's colour.
  expect(health.style.color).toBe('');
  expect(health).toHaveClass('text-slate-500');
});

it('shows only the filtered distribution when one category is selected', () => {
  state.loaded = true;
  render(<SentimentChart />);
  expect(screen.getAllByRole('group', { name: /Positive:.*Neutral:.*Negative:/ })).toHaveLength(1);
  expect(screen.queryByText('Overall')).not.toBeInTheDocument();
  expect(screen.queryByText('Per Category')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Next category' })).not.toBeInTheDocument();
  expect(overview.mock.calls.every(args => (args as unknown[])[0] === 'business')).toBe(true);
});

it('keeps the per-category reasons open when the category changes', () => {
  const none = { count: 0, themes: [], examples: [] };
  const evidence = (id: string) => ({ positive: { count: 1, themes: [], examples: [{ id, title: `Story ${id}`, language: 'en' }] }, neutral: none, negative: none });
  const original = overview.getMockImplementation()!;
  overview.mockImplementation(() => ({ data: { sentiments: { positive: 2, neutral: 0, negative: 0 },
    byCategory: Object.values(CATEGORY_LABELS).map(topic => ({ topic, sentiments: { positive: 1, neutral: 0, negative: 0 }, evidence: evidence(topic.toLowerCase()) })),
  }, isPending: false, isError: false }) as unknown as ReturnType<typeof original>);
  vi.useFakeTimers();
  try {
    state.category = 'all';
    render(<MemoryRouter><SentimentChart /></MemoryRouter>);
    const details = screen.getByText('View reasons and examples').parentElement as HTMLDetailsElement;
    details.open = true;
    fireEvent(details, new Event('toggle'));
    expect(screen.getByRole('link', { name: 'Story sport' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next category' }));
    expect((screen.getByText('View reasons and examples').parentElement as HTMLDetailsElement).open).toBe(true);
    expect(screen.getByRole('link', { name: 'Story health' })).toBeInTheDocument();
    // Open reasons no longer hold the rotation: the next category comes up on the timer, still open.
    act(() => { vi.advanceTimersByTime(10000); });
    expect(screen.getByRole('button', { name: 'Health' })).not.toHaveAttribute('aria-current');
    expect((screen.getByText('View reasons and examples').parentElement as HTMLDetailsElement).open).toBe(true);
    expect(screen.queryByRole('link', { name: 'Story health' })).not.toBeInTheDocument();
  } finally {
    vi.useRealTimers();
    overview.mockImplementation(original);
  }
});

it('steps through the categories with arrows either side of the dots, wrapping at the ends', () => {
  state.loaded = true; state.category = 'all';
  render(<SentimentChart />);
  const dots = within(screen.getByRole('group', { name: 'Per Category' })).getAllByRole('button');
  expect(dots[0]).toHaveAttribute('aria-current', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Previous category' }));
  expect(dots[dots.length - 1]).toHaveAttribute('aria-current', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Next category' }));
  expect(dots[0]).toHaveAttribute('aria-current', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Next category' }));
  expect(dots[1]).toHaveAttribute('aria-current', 'true');
});
