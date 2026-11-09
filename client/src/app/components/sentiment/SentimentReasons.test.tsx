import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { SentimentReasons } from './SentimentReasons';
import type { SentimentEvidence } from '../../hooks/useStats';
vi.mock('../../contexts/AppContext', () => ({ useApp: () => ({ t: { positive: 'Positive', neutral: 'Neutral', negative: 'Negative' }, selectedSentiments: ['negative'] }) }));
vi.mock('../../hooks/useTitleTranslations', () => ({ useTitleTranslations: (articles: unknown[]) => articles }));
vi.mock('../article/ArticleSentimentExplanation', () => ({ ArticleSentimentExplanation: ({ article }: { article: { id: string } }) => <p>AI reason for {article.id}</p> }));
afterEach(cleanup);
const empty = { count: 0, themes: [], examples: [] };
const evidence: SentimentEvidence = { positive: empty, neutral: empty, negative: { count: 5, themes: [{ label: 'Conflict and security', count: 3 }], examples: [{ id: 'story-1', title: 'A reported conflict', language: 'en' }] } };
it('keeps the summary visible, discloses filtered shares and opens linked evidence', () => {
  render(<MemoryRouter><SentimentReasons evidence={evidence} /></MemoryRouter>);
  expect(screen.getByText('Negative (100%)')).toBeVisible();
  expect(screen.getByText(/Sentiment filters are active/)).toBeVisible();
  const details = screen.getByText('View reasons and examples').parentElement as HTMLDetailsElement;
  details.open = true;
  fireEvent(details, new Event('toggle'));
  expect(screen.getByRole('link', { name: 'A reported conflict' })).toHaveAttribute('href', '/article/story-1');
  expect(screen.getByText(/not the model’s internal reasoning/)).toBeVisible();
  expect(screen.getByText('AI reason for story-1')).toBeVisible();
  expect(screen.getByText(/Based on the first supporting article/)).toBeVisible();
});
it('shows one sentiment at a time, opening on the largest, and states the caveats once', () => {
  const both: SentimentEvidence = { ...evidence, positive: { count: 2, themes: [], examples: [{ id: 'story-2', title: 'A good result', language: 'en' }] } };
  render(<MemoryRouter><SentimentReasons evidence={both} show="open" /></MemoryRouter>);
  expect(screen.queryByText('View reasons and examples')).not.toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /Negative/ })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('link', { name: 'A reported conflict' })).toBeVisible();
  expect(screen.queryByRole('link', { name: 'A good result' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: /Positive/ }));
  expect(screen.getByRole('link', { name: 'A good result' })).toBeVisible();
  expect(screen.getAllByText(/Based on the first supporting article/)).toHaveLength(1);
  expect(screen.getByText('Pattern summary')).toBeVisible();
});
it('does not invent a dominant sentiment for empty results', () => {
  render(<MemoryRouter><SentimentReasons evidence={{ positive: empty, neutral: empty, negative: empty }} /></MemoryRouter>);
  expect(screen.getByText('No articles match these filters.')).toBeVisible();
  expect(screen.queryByText(/Largest share/)).not.toBeInTheDocument();
});

const all: SentimentEvidence = {
  positive: { count: 9, themes: [], examples: [{ id: 'story-2', title: 'A good result', language: 'en' }] },
  neutral: { count: 1, themes: [], examples: [{ id: 'story-3', title: 'A plain update', language: 'en' }] },
  negative: evidence.negative,
};

it('stays on one sentiment, and a new category starts on its largest with the AI reason on request', () => {
  const { rerender } = render(<MemoryRouter><SentimentReasons evidence={evidence} scopeKey="sport" /></MemoryRouter>);
  const details = screen.getByText('View reasons and examples').parentElement as HTMLDetailsElement;
  details.open = true;
  fireEvent(details, new Event('toggle'));
  expect(screen.getByText('AI reason for story-1')).toBeVisible();
  rerender(<MemoryRouter><SentimentReasons evidence={all} scopeKey="business" /></MemoryRouter>);
  expect(screen.getByRole('tab', { name: /Positive/ })).toHaveAttribute('aria-selected', 'true');
  expect(screen.queryByText('AI reason for story-2')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Show AI explanation' }));
  expect(screen.getByText('AI reason for story-2')).toBeVisible();
  expect(screen.queryByTestId('reasons-progress')).not.toBeInTheDocument();
});
it('opens the tab of a polarity picked on the pie, each time it is picked', () => {
  const both: SentimentEvidence = { ...evidence, positive: { count: 2, themes: [], examples: [{ id: 'story-2', title: 'A good result', language: 'en' }] } };
  const view = (focus?: { type: 'positive' | 'negative' }) => <MemoryRouter><SentimentReasons evidence={both} show="open" focus={focus} /></MemoryRouter>;
  const { rerender } = render(view());
  rerender(view({ type: 'positive' }));
  expect(screen.getByRole('tab', { name: /Positive/ })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByText('AI reason for story-2')).toBeVisible();
  fireEvent.click(screen.getByRole('tab', { name: /Negative/ }));
  rerender(view({ type: 'positive' }));
  expect(screen.getByRole('tab', { name: /Positive/ })).toHaveAttribute('aria-selected', 'true');
});
it('reports a picked tab', () => {
  const both: SentimentEvidence = { ...evidence, positive: { count: 2, themes: [], examples: [{ id: 'story-2', title: 'A good result', language: 'en' }] } };
  const onPick = vi.fn();
  render(<MemoryRouter><SentimentReasons evidence={both} show="open" onPick={onPick} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('tab', { name: /Positive/ }));
  expect(onPick).toHaveBeenLastCalledWith('positive');
});
