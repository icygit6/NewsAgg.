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
function leave(element: Element) {
  const event = new Event('pointerout', { bubbles: true });
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  fireEvent(element, event);
}
it('closes hovered details as soon as the pointer leaves the slice', () => {
  render(<SentimentExplorer counts={{ positive: 1, neutral: 5, negative: 4 }} sources={sources} scopeKey="all" />);
  const slice = screen.getByRole('img', { name: 'Neutral: 5 (50%)' });
  hover(slice);
  expect(screen.getByTestId('sentiment-source-detail')).toBeInTheDocument();
  leave(slice);
  expect(screen.queryByTestId('sentiment-source-detail')).not.toBeInTheDocument();
});
const arc = (name: string) => document.querySelector(`[data-donut-arc="${name}"]`);
it('keeps details chosen from a polarity bar open; hovering another slice changes nothing', () => {
  render(<><SentimentExplorer counts={{ positive: 1, neutral: 5, negative: 4 }} sources={sources} scopeKey="all" /><p>Outside</p></>);
  fireEvent.click(screen.getByRole('button', { name: /Negative/ }));
  expect(screen.getByTestId('sentiment-source-detail')).toHaveTextContent('Negative');
  const slice = screen.getByRole('img', { name: 'Neutral: 5 (50%)' });
  hover(slice);
  expect(screen.getByTestId('sentiment-source-detail')).toHaveTextContent('Negative');
  expect(arc('Neutral')).toHaveStyle({ opacity: '0.25' });
  leave(slice);
  expect(screen.getByTestId('sentiment-source-detail')).toHaveTextContent('Negative');
  fireEvent.click(screen.getByText('Outside'));
  expect(screen.queryByTestId('sentiment-source-detail')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Positive/ }));
  fireEvent.click(screen.getByRole('button', { name: 'All sentiments' }));
  expect(screen.queryByTestId('sentiment-source-detail')).not.toBeInTheDocument();
});
it('closes pinned details on a click on whitespace inside the explorer', () => {
  render(<SentimentExplorer counts={{ positive: 1, neutral: 5, negative: 4 }} sources={sources} scopeKey="all" />);
  fireEvent.click(screen.getByRole('img', { name: 'Negative: 4 (40%)' }));
  fireEvent.click(screen.getByTestId('sentiment-source-detail'));
  expect(screen.queryByTestId('sentiment-source-detail')).not.toBeInTheDocument();
});
it('keeps the hover target still while the visible slice grows', () => {
  render(<SentimentExplorer counts={{ positive: 1, neutral: 5, negative: 4 }} sources={sources} scopeKey="all" />);
  const slice = screen.getByRole('img', { name: 'Neutral: 5 (50%)' });
  hover(slice);
  expect(arc('Neutral')).toHaveStyle({ strokeWidth: '30' });
  expect(slice.getAttribute('style')).not.toMatch(/transform|stroke-width/);
});
it('pins a slice that is tapped, highlighting it until All sentiments or a tap outside', () => {
  render(<><SentimentExplorer counts={{ positive: 1, neutral: 5, negative: 4 }} sources={sources} scopeKey="all" /><p>Outside</p></>);
  const slice = screen.getByRole('img', { name: 'Negative: 4 (40%)' });
  fireEvent.click(slice);
  leave(slice);
  expect(screen.getByTestId('sentiment-source-detail')).toHaveTextContent('Negative');
  expect(arc('Neutral')).toHaveStyle({ opacity: '0.25' });
  fireEvent.click(screen.getByRole('img', { name: 'Neutral: 5 (50%)' }));
  expect(screen.getByTestId('sentiment-source-detail')).toHaveTextContent('Neutral');
  expect(arc('Negative')).toHaveStyle({ opacity: '0.25' });
  fireEvent.click(screen.getByText('Outside'));
  expect(screen.queryByTestId('sentiment-source-detail')).not.toBeInTheDocument();
  fireEvent.click(slice);
  fireEvent.click(screen.getByRole('button', { name: 'All sentiments' }));
  expect(screen.queryByTestId('sentiment-source-detail')).not.toBeInTheDocument();
});
it('clears a selected sentiment when the filtered snapshot changes', () => {
  const { rerender } = render(<SentimentExplorer counts={{ positive: 1, neutral: 5, negative: 4 }} sources={sources} scopeKey="all" />);
  hover(screen.getByRole('img', { name: 'Negative: 4 (40%)' }));
  rerender(<SentimentExplorer counts={{ positive: 0, neutral: 1, negative: 0 }} sources={[]} scopeKey="sport" />);
  expect(screen.queryByTestId('sentiment-source-detail')).not.toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Neutral: 1 (100%)' })).toBeInTheDocument();
});
it('offers All sentiments only once pinned, and reports clicked picks but not hovers', () => {
  const onPick = vi.fn();
  render(<SentimentExplorer counts={{ positive: 1, neutral: 5, negative: 4 }} sources={sources} scopeKey="all" onPick={onPick} />);
  const slice = screen.getByRole('img', { name: 'Neutral: 5 (50%)' });
  hover(slice);
  expect(screen.getByText('All sentiments').closest('button')).toHaveClass('invisible');
  expect(onPick).not.toHaveBeenCalled();
  fireEvent.click(slice);
  expect(screen.getByRole('button', { name: 'All sentiments' })).not.toHaveClass('invisible');
  expect(onPick).toHaveBeenLastCalledWith('neutral');
});
it('shows the selected share in the middle of the pie instead of the logos', () => {
  render(<SentimentExplorer counts={{ positive: 1, neutral: 5, negative: 4 }} sources={sources} scopeKey="all" />);
  fireEvent.click(screen.getByRole('img', { name: 'Negative: 4 (40%)' }));
  expect(screen.getByText('40%')).toBeInTheDocument();
});
it('moves a pinned polarity to a tab picked in the reasons, which do not count as a click outside', () => {
  const view = (selection?: { type: 'positive' | 'neutral' }) => <><SentimentExplorer counts={{ positive: 1, neutral: 5, negative: 4 }} sources={sources} scopeKey="all" selection={selection} /><button type="button" data-reason-tab>Tab</button></>;
  const { rerender } = render(view());
  rerender(view({ type: 'positive' }));
  expect(screen.queryByTestId('sentiment-source-detail')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('img', { name: 'Negative: 4 (40%)' }));
  fireEvent.click(screen.getByText('Tab'));
  expect(screen.getByTestId('sentiment-source-detail')).toHaveTextContent('Negative');
  rerender(view({ type: 'neutral' }));
  expect(screen.getByTestId('sentiment-source-detail')).toHaveTextContent('Neutral');
});
it('closes when the pinned slice is clicked or tapped again', () => {
  render(<SentimentExplorer counts={{ positive: 1, neutral: 5, negative: 4 }} sources={sources} scopeKey="all" />);
  const slice = screen.getByRole('img', { name: 'Negative: 4 (40%)' });
  fireEvent.click(slice);
  expect(screen.getByTestId('sentiment-source-detail')).toHaveTextContent('Negative');
  fireEvent.click(slice);
  expect(screen.queryByTestId('sentiment-source-detail')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Neutral/ }));
  fireEvent.click(screen.getByRole('img', { name: 'Neutral: 5 (50%)' }));
  expect(screen.queryByTestId('sentiment-source-detail')).not.toBeInTheDocument();
});
