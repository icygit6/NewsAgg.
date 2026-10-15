import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SentimentChart } from './SentimentChart';
const state = vi.hoisted(() => ({ error: false }));
vi.mock('../../contexts/AppContext', () => ({ useApp: () => ({ isDark: false, selectedCategory: 'business', t: { loading: 'Loading...', fetchFailed: 'Could not load', sentimentDistribution: 'Sentiment', allCategories: 'All' } }) }));
vi.mock('../../hooks/useStats', () => ({ useStatsOverview: () => ({ data: undefined, isPending: !state.error, isError: state.error }) }));
afterEach(() => { cleanup(); state.error = false; });
it('shows progress instead of fabricated zero sentiment counts while loading', () => {
  render(<SentimentChart />);
  expect(screen.getAllByRole('status')).toHaveLength(2);
  expect(screen.queryByText('0 (0%)')).not.toBeInTheDocument();
});
it('shows errors instead of empty sentiment distributions when requests fail', () => {
  state.error = true;
  render(<SentimentChart />);
  expect(screen.getAllByRole('alert')).toHaveLength(2);
  expect(screen.queryByText('0 (0%)')).not.toBeInTheDocument();
});
