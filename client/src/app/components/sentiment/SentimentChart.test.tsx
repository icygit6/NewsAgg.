import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SentimentChart } from './SentimentChart';
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
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByRole('group', { name: 'Positive: 0 (0%), Neutral: 5 (100%), Negative: 0 (0%)' })).toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(overview.mock.calls.every((args) => (args as unknown[])[0] === 'all')).toBe(true);
});

it('allows direct category navigation using colored dots without changing the feed filter', () => {
  state.loaded = true; state.category = 'all';
  render(<SentimentChart />);
  const health = screen.getByRole('button', { name: 'Health' });
  fireEvent.click(health);
  expect(health).toHaveAttribute('aria-current', 'true');
  expect(screen.getByRole('group', { name: 'Positive: 0 (0%), Neutral: 5 (100%), Negative: 0 (0%)' })).toBeInTheDocument();
  expect(state.category).toBe('all');
  expect(health.style.color).not.toBe('');
});

it('shows only the filtered distribution when one category is selected', () => {
  state.loaded = true;
  render(<SentimentChart />);
  expect(screen.getAllByRole('group', { name: /Positive:.*Neutral:.*Negative:/ })).toHaveLength(1);
  expect(screen.queryByText('Overall')).not.toBeInTheDocument();
  expect(screen.queryByText('Per Category')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  expect(overview.mock.calls.every(args => (args as unknown[])[0] === 'business')).toBe(true);
});
