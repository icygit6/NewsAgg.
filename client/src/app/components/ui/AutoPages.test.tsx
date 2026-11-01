import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AutoPages } from './AutoPages';

// jsdom has no AnimationEvent, so React would listen for a vendor-prefixed name and never hear 'animationend'.
// Hoisted above the imports because React reads this once, when it loads.
vi.hoisted(() => { (globalThis as { AnimationEvent?: unknown }).AnimationEvent ??= class AnimationEvent extends Event {}; });

const state = vi.hoisted(() => ({ reducedMotion: false }));

vi.mock('../../contexts/AppContext', () => ({ useApp: () => ({ language: 'en' }) }));
vi.mock('motion/react', async (original) => ({ ...(await original<typeof import('motion/react')>()), useReducedMotion: () => state.reducedMotion }));

const rows = (count: number) => Array.from({ length: count }, (_, n) => <p key={n}>Row {n + 1}</p>);
// The panel the list sits in: hovering or focusing anywhere in it counts as reading.
const view = (count: number) => render(<section data-testid="panel"><h3>Live View</h3><AutoPages items={rows(count)} label="Live View" scopeKey="all" /></section>);
const bar = () => screen.queryByTestId('auto-pages-progress') as HTMLElement | null;
const playState = () => bar()?.style.animationPlayState;

beforeEach(() => { state.reducedMotion = false; });
afterEach(cleanup);

it('shows one timer bar when there is more than one page, and none for a single page', () => {
  view(25);
  expect(bar()).not.toBeNull();
  expect(playState()).toBe('running');
  cleanup();
  view(10);
  expect(bar()).toBeNull();
});

it('turns to the next page, wrapping at the end, when the bar finishes: the bar is the timer', () => {
  view(25);
  const list = screen.getByRole('region', { name: 'Live View' });
  Object.defineProperty(list, 'clientWidth', { configurable: true, value: 300 });
  const scrollTo = vi.fn();
  list.scrollTo = scrollTo;
  fireEvent.animationEnd(bar()!);
  expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ left: 300 }));
});

it('pauses the bar while a mouse hovers or focus is inside the panel, but not for a touch', () => {
  view(25);
  const panel = screen.getByTestId('panel');
  fireEvent.pointerEnter(panel, { pointerType: 'mouse' });
  expect(playState()).toBe('paused');
  fireEvent.pointerLeave(panel, { pointerType: 'mouse' });
  expect(playState()).toBe('running');
  fireEvent.pointerEnter(panel, { pointerType: 'touch' });
  expect(playState()).toBe('running');
  fireEvent.focusIn(screen.getByRole('region', { name: 'Live View' }));
  expect(playState()).toBe('paused');
  fireEvent.focusOut(screen.getByRole('region', { name: 'Live View' }), { relatedTarget: document.body });
  expect(playState()).toBe('running');
});

it('starts the bar over when the reader touches the list', () => {
  view(25);
  const before = bar();
  fireEvent.pointerDown(screen.getByRole('region', { name: 'Live View' }));
  expect(bar()).not.toBe(before);
});

it('drops automatic paging, and its bar, when the reader prefers reduced motion', () => {
  state.reducedMotion = true;
  view(25);
  expect(bar()).toBeNull();
});
