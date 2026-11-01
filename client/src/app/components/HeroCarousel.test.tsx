import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HeroCarousel } from './HeroCarousel';

// jsdom has no AnimationEvent, so React would listen for a vendor-prefixed name and never hear 'animationend'.
// Hoisted above the imports because React reads this once, when it loads.
vi.hoisted(() => { (globalThis as { AnimationEvent?: unknown }).AnimationEvent ??= class AnimationEvent extends Event {}; });

const state = vi.hoisted(() => ({ result: { data: { articles: [] as unknown[] }, isLoading: false }, reducedMotion: false }));

vi.mock('../contexts/AppContext', () => ({
  useApp: () => ({
    t: { loading: 'Loading', topHeadlines: 'Top headlines', previous: 'Previous', next: 'Next', goToSlide: 'Go to slide', positive: 'Positive', neutral: 'Neutral', negative: 'Negative' },
    isDark: false, language: 'en', selectedCategory: 'all', selectedSources: [], selectedSentiment: 'all',
  }),
}));
// react-query hands back the same object until the data really changes; the carousel resets on that identity.
vi.mock('../hooks/useArticles', () => ({ useRankedHeadlines: () => state.result }));
vi.mock('motion/react', async (original) => ({ ...(await original<typeof import('motion/react')>()), useReducedMotion: () => state.reducedMotion }));
vi.mock('../hooks/useTitleTranslations', () => ({ useTitleTranslations: (articles: unknown) => articles }));

const headline = (n: number) => ({
  id: `a${n}`, url: `https://example.com/story-${n}`, title: `Story number ${n}`, topic: 'World', publishedAt: new Date().toISOString(),
  urlToImage: `https://example.com/photo-${n}.jpg`, images: [{ url: `https://example.com/photo-${n}.jpg` }],
  sentiment: { type: 'neutral' }, source: { name: 'BBC' }, readability: { readingTimeMin: 3 },
});

const setHeadlines = (count: number) => { state.result = { data: { articles: Array.from({ length: count }, (_, n) => headline(n + 1)) }, isLoading: false }; };

beforeEach(() => {
  setHeadlines(3);
  state.reducedMotion = false;
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false, media: query,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(),
  }));
  vi.stubGlobal('Image', class { referrerPolicy = ''; decoding = ''; src = ''; });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const view = () => render(<MemoryRouter><HeroCarousel /></MemoryRouter>);
const bar = () => screen.queryByTestId('hero-progress') as HTMLElement | null;
const slide = () => screen.getAllByRole('button').findIndex((button) => button.getAttribute('aria-current') === 'true') - 2; // two arrows precede the dots

it('shows the first slide and one progress bar', () => {
  view();
  expect(screen.getByText('Story number 1')).toBeInTheDocument();
  expect(bar()).not.toBeNull();
  expect(slide()).toBe(0);
});

it('advances when, and only when, the progress bar finishes: the bar is the timer', () => {
  view();
  fireEvent.animationEnd(bar()!);
  expect(slide()).toBe(1);
  fireEvent.animationEnd(bar()!);
  fireEvent.animationEnd(bar()!);
  expect(slide()).toBe(0); // wraps after the last slide
});

it('restarts the bar from zero on every slide change, however it was reached', () => {
  view();
  const first = bar();
  fireEvent.click(screen.getByLabelText('Next'));
  expect(bar()).not.toBe(first);
  const second = bar();
  fireEvent.click(screen.getByLabelText('Go to slide 3'));
  expect(bar()).not.toBe(second);
  const third = bar();
  fireEvent.click(screen.getByLabelText('Previous'));
  expect(bar()).not.toBe(third);
  expect(slide()).toBe(1);
});

it('pauses the bar, not just the timer, while a mouse hovers or focus is inside', () => {
  const { container } = view();
  const root = container.firstElementChild as HTMLElement;
  expect(bar()!.style.animationPlayState).toBe('running');
  fireEvent.pointerOver(root, { pointerType: 'mouse' });
  expect(bar()!.style.animationPlayState).toBe('paused');
  fireEvent.pointerOut(root, { pointerType: 'mouse' });
  expect(bar()!.style.animationPlayState).toBe('running');
  fireEvent.focus(screen.getByLabelText('Next'));
  expect(bar()!.style.animationPlayState).toBe('paused');
  fireEvent.blur(screen.getByLabelText('Next'), { relatedTarget: document.body });
  expect(bar()!.style.animationPlayState).toBe('running');
});

it('does not stay paused after a tap on a touch screen', () => {
  const { container } = view();
  fireEvent.pointerOver(container.firstElementChild as HTMLElement, { pointerType: 'touch' });
  expect(bar()!.style.animationPlayState).toBe('running');
});

it('holds the bar while the tab is hidden and resumes with it', () => {
  view();
  const hidden = vi.spyOn(document, 'hidden', 'get');
  hidden.mockReturnValue(true);
  act(() => { document.dispatchEvent(new Event('visibilitychange')); });
  expect(bar()!.style.animationPlayState).toBe('paused');
  hidden.mockReturnValue(false);
  act(() => { document.dispatchEvent(new Event('visibilitychange')); });
  expect(bar()!.style.animationPlayState).toBe('running');
  hidden.mockRestore();
});

it('swiping moves a slide and the click that follows does not open the article', () => {
  const { container } = view();
  const root = container.firstElementChild as HTMLElement;
  fireEvent.pointerDown(root, { clientX: 220, clientY: 100 });
  fireEvent.pointerUp(root, { clientX: 100, clientY: 108 });
  expect(slide()).toBe(1);
  const link = screen.getByText('Story number 2').closest('a')!;
  expect(fireEvent.click(link)).toBe(false); // default prevented: no navigation
  fireEvent.pointerDown(root, { clientX: 100, clientY: 100 });
  fireEvent.pointerUp(root, { clientX: 230, clientY: 100 });
  expect(slide()).toBe(0);
});

it('ignores short drags and mostly-vertical drags', () => {
  const { container } = view();
  const root = container.firstElementChild as HTMLElement;
  fireEvent.pointerDown(root, { clientX: 100, clientY: 100 });
  fireEvent.pointerUp(root, { clientX: 130, clientY: 100 });
  fireEvent.pointerDown(root, { clientX: 100, clientY: 100 });
  fireEvent.pointerUp(root, { clientX: 20, clientY: 190 });
  expect(slide()).toBe(0);
});

it('has no bar and no autoplay with one headline, or when the reader prefers reduced motion', () => {
  setHeadlines(1);
  view();
  expect(bar()).toBeNull();
  cleanup();
  setHeadlines(2);
  state.reducedMotion = true;
  view();
  expect(bar()).toBeNull();
  expect(slide()).toBe(0);
});

it('preloads the next slide photo with the same referrer policy as the visible image', () => {
  const made: Array<{ src: string; referrerPolicy: string }> = [];
  vi.stubGlobal('Image', class { referrerPolicy = ''; decoding = ''; _src = ''; set src(value: string) { this._src = value; made.push({ src: value, referrerPolicy: this.referrerPolicy }); } get src() { return this._src; } });
  view();
  expect(made).toEqual([{ src: 'https://example.com/photo-2.jpg', referrerPolicy: 'no-referrer' }]);
  fireEvent.animationEnd(bar()!);
  expect(made[made.length - 1].src).toBe('https://example.com/photo-3.jpg');
});
