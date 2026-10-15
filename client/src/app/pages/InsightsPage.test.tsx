import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { InsightsPage } from './InsightsPage';

vi.mock('../contexts/AppContext', () => ({ useApp: () => ({ language: 'en', isDark: false, selectedCategory: 'all', t: { insights: 'Insights', insightsNote: 'Live dataset', methodologyTitle: 'How it works' } }) }));
const mocks = vi.hoisted(() => ({ stats: vi.fn(), articles: vi.fn() }));
vi.mock('../hooks/useStats', () => ({ useStatsOverview: mocks.stats, useBusinessTrend: vi.fn(), useMarkets: vi.fn(), useTrendingStats: vi.fn() }));
vi.mock('../hooks/useArticles', () => ({ useLatestArticles: mocks.articles }));
afterEach(cleanup);
it('opens the research deep link without mounting database-backed feed hooks', () => {
  render(<MemoryRouter initialEntries={['/insights?view=research']}><InsightsPage /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'Behind the analysis' })).toBeInTheDocument();
  expect(mocks.stats).not.toHaveBeenCalled();
  expect(mocks.articles).not.toHaveBeenCalled();
});
