import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DonutChart } from './DonutChart';

const motionState = vi.hoisted(() => ({ reduced: false }));
vi.mock('motion/react', async (original) => ({
  ...(await original<typeof import('motion/react')>()),
  useReducedMotion: () => motionState.reduced,
}));
afterEach(() => { cleanup(); motionState.reduced = false; });

function hover(element: Element) {
  const event = new Event('pointerover', { bubbles: true });
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  fireEvent(element, event);
}

const positive = [{ name: 'Positive', value: 10, color: '#10b981' }];
const negative = [{ name: 'Negative', value: 20, color: '#ef4444' }];

it('updates the accessible distribution immediately when the category changes', () => {
  const { rerender } = render(<DonutChart segments={positive} transitionKey="sport" />);
  expect(screen.getByRole('group')).toHaveAccessibleName('Positive: 10 (100%)');
  rerender(<DonutChart segments={negative} transitionKey="health" />);
  expect(screen.getAllByRole('group')).toHaveLength(1);
  expect(screen.getByRole('group')).toHaveAccessibleName('Negative: 20 (100%)');
});

it('keeps empty categories explicit instead of making up sentiment shares', () => {
  render(<DonutChart segments={[]} transitionKey="science" />);
  expect(screen.getByRole('group')).toHaveAccessibleName('No sentiment data');
});

it('preserves the data and fixed layout with reduced motion', () => {
  motionState.reduced = true;
  render(<DonutChart segments={positive} size={112} />);
  expect(screen.getByRole('group')).toHaveStyle({ width: '112px', height: '112px' });
  expect(screen.getByRole('group')).toHaveAccessibleName('Positive: 10 (100%)');
  expect(document.querySelector('[data-donut-segment]')).toHaveStyle({ transition: 'none' });
});

it('exposes counts only through hover without focus or click selection and clears a previous category selection', () => {
  const { rerender } = render(<DonutChart segments={positive} transitionKey="sport" />);
  const arc = screen.getByRole('img', { name: 'Positive: 10 (100%)' });
  expect(arc).not.toHaveAttribute('tabindex');
  hover(arc);
  expect(screen.getByText('Positive · 100%')).toBeInTheDocument();
  expect(screen.getByText('10 articles')).toBeInTheDocument();
  expect(screen.getByText('10 articles').parentElement).toHaveStyle({ color: '#10b981' });
  const leave = new Event('pointerout', { bubbles: true });
  Object.defineProperty(leave, 'pointerType', { value: 'mouse' });
  fireEvent(arc, leave);
  expect(screen.queryByText('Positive · 100%')).not.toBeInTheDocument();
  expect(screen.queryByText('Hover, tap or focus a segment')).not.toBeInTheDocument();
  fireEvent.click(arc);
  expect(arc).not.toHaveAttribute('aria-pressed');
  expect(screen.queryByText('Positive · 100%')).not.toBeInTheDocument();
  rerender(<DonutChart segments={negative} transitionKey="health" />);
  expect(screen.queryByText('Positive · 100%')).not.toBeInTheDocument();
});

it('morphs existing arcs instead of replacing the chart on every category', () => {
  const initial = [...positive, { name: 'Neutral', value: 10, color: '#f59e0b' }];
  const { container, rerender } = render(<DonutChart segments={initial} transitionKey="sport" />);
  const arc = container.querySelector('[data-donut-segment="Positive"]');
  const previous = (arc as SVGElement).style.strokeDasharray;
  rerender(<DonutChart segments={[{ ...positive[0], value: 30 }, initial[1]]} transitionKey="health" />);
  expect(container.querySelector('[data-donut-segment="Positive"]')).toBe(arc);
  expect((arc as SVGElement).style.strokeDasharray).not.toBe(previous);
  expect((arc as SVGElement).style.transition).toContain('650ms');
});
