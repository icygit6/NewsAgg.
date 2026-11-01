import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SentimentByCategory } from './SentimentByCategory';

const state = vi.hoisted(() => ({ selectedCategory: 'all' as string, setSelectedCategory: vi.fn() }));
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    isDark: false,
    selectedCategory: state.selectedCategory,
    setSelectedCategory: state.setSelectedCategory,
    t: { loading: 'Loading...', fetchFailed: 'Could not load', sentimentDistribution: 'Sentiment', allCategories: 'All', positive: 'Positive', neutral: 'Neutral', negative: 'Negative' },
  }),
}));
vi.mock('../../hooks/useStats', () => ({
  useStatsOverview: () => ({
    isPending: false,
    isError: false,
    data: {
      sentiments: { positive: 30, neutral: 40, negative: 50 },
      byCategory: [
        { topic: 'Climate', total: 20, sentiments: { positive: 1, neutral: 2, negative: 17 } },
        { topic: 'Sport', total: 100, sentiments: { positive: 29, neutral: 38, negative: 33 } },
      ],
    },
  }),
}));
afterEach(() => { cleanup(); state.selectedCategory = 'all'; vi.clearAllMocks(); });

it('ranks every category by volume and names the most positive and negative', () => {
  render(<SentimentByCategory />);
  const rows = within(screen.getByRole('list')).getAllByRole('button');
  expect(rows.map((row) => row.textContent)).toEqual([expect.stringContaining('Sport'), expect.stringContaining('Climate')]);
  expect(screen.getByText(/Most positive: Sport 29%/)).toBeInTheDocument();
  expect(screen.getByText(/Most negative: Climate 85%/)).toBeInTheDocument();
});

it('applies a category site-wide and hides the redundant comparison', () => {
  render(<SentimentByCategory />);
  fireEvent.click(within(screen.getByRole('list')).getAllByRole('button')[1]);
  expect(state.setSelectedCategory).toHaveBeenCalledWith('climate');

  cleanup();
  state.selectedCategory = 'climate';
  render(<SentimentByCategory />);
  expect(screen.queryByRole('region', { name: 'All categories ranked' })).not.toBeInTheDocument();
  // The donut now describes the chosen category, not the whole dataset.
  expect(within(screen.getByRole('region', { name: 'Sentiment: Climate' })).getByRole('group', { name: 'Positive: 1 (5%), Neutral: 2 (10%), Negative: 17 (85%)' })).toBeInTheDocument();
});
