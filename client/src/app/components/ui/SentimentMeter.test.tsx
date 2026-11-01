import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('../../contexts/AppContext', () => ({ useApp: () => ({ t: { negative: 'Negative', neutral: 'Neutral', positive: 'Positive' } }) }));
import { SentimentMeter } from './SentimentMeter';

afterEach(cleanup);

const marker = (container: HTMLElement) => container.querySelector('[role="meter"] [style*="translateX"]') as HTMLElement;

it('shows the signed score, the label and a meter with the real value', () => {
  const { container } = render(<SentimentMeter value={-0.24} type="negative" label="Negative" />);
  expect(screen.getByText('Negative', { selector: 'span.rounded-full' })).toBeInTheDocument();
  expect(screen.getByText('−0.24')).toBeInTheDocument();
  const meter = screen.getByRole('meter');
  expect(meter).toHaveAttribute('aria-valuenow', '-0.24');
  expect(meter).toHaveAttribute('aria-valuetext', 'Negative, -0.24');
  // −0.24 sits 38% along the −1…+1 track.
  expect(marker(container).style.transform).toBe('translateX(38%)');
});

it('clamps values outside −1…+1 and treats a missing score as neutral', () => {
  const { container, rerender } = render(<SentimentMeter value={3} type="positive" label="Positive" />);
  expect(marker(container).style.transform).toBe('translateX(100%)');
  expect(screen.getByText('+1.00')).toBeInTheDocument();
  rerender(<SentimentMeter value={Number.NaN} type="neutral" label="Neutral" />);
  expect(marker(container).style.transform).toBe('translateX(50%)');
  expect(screen.getByText('0.00')).toBeInTheDocument();
});

it('slides the marker out from neutral (the CSS keeps it still under reduced motion)', () => {
  const { container } = render(<SentimentMeter value={0.5} type="positive" label="Positive" />);
  expect(marker(container)).toHaveClass('meter-slide');
});
