import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SentimentExplorer } from './SentimentExplorer';

vi.mock('../../contexts/AppContext', () => ({ useApp: () => ({ language: 'en', isDark: false, t: { positive: 'Positive', neutral: 'Neutral', negative: 'Negative' } }) }));
vi.mock('../../i18n/uiText', () => ({ useUiText: () => (value: string) => value }));
vi.mock('motion/react', async importOriginal => ({
  ...await importOriginal<typeof import('motion/react')>(),
  useReducedMotion: () => true,
}));
afterEach(cleanup);

function hover(element: Element) {
  const event = new Event('pointerover', { bubbles: true });
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  fireEvent(element, event);
}

const sources = [
  { id: 'bbc', name: 'BBC', domain: 'bbc.com', total: 4, sentiments: { positive: 1, neutral: 1, negative: 2 } },
  { id: 'cnn', name: 'CNN', domain: 'cnn.com', total: 6, sentiments: { positive: 0, neutral: 4, negative: 2 } },
];
it('shows the selected sentiment and source shares, then restores the overview with Escape', () => {
  render(<SentimentExplorer counts={{ positive: 1, neutral: 5, negative: 4 }} sources={sources} scopeKey="all" />);
  hover(screen.getByRole('img', { name: 'Neutral: 5 (50%)' }));
  const detail = screen.getByTestId('sentiment-source-detail');
  expect(detail).toHaveTextContent('5 · 50%');
  expect(within(detail).getByText('BBC').closest('li')).toHaveTextContent('1 · 20%');
  expect(within(detail).getByText('CNN').closest('li')).toHaveTextContent('4 · 80%');
  fireEvent.keyDown(detail, { key: 'Escape' });
  expect(screen.queryByTestId('sentiment-source-detail')).not.toBeInTheDocument();
});
it('clears a selected sentiment when the filtered snapshot changes', () => {
  const { rerender } = render(<SentimentExplorer counts={{ positive: 1, neutral: 5, negative: 4 }} sources={sources} scopeKey="all" />);
  hover(screen.getByRole('img', { name: 'Negative: 4 (40%)' }));
  rerender(<SentimentExplorer counts={{ positive: 0, neutral: 1, negative: 0 }} sources={[]} scopeKey="sport" />);
  expect(screen.queryByTestId('sentiment-source-detail')).not.toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Neutral: 1 (100%)' })).toBeInTheDocument();
});
