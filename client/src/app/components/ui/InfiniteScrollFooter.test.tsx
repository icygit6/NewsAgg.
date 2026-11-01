import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { InfiniteScrollFooter } from './InfiniteScrollFooter';

type Observed = { callback: IntersectionObserverCallback; target: Element; root: Element | Document | null | undefined; rootMargin?: string; disconnected: boolean };
const observers: Observed[] = [];
let visibleOnObserve = false;

beforeEach(() => {
  observers.length = 0;
  visibleOnObserve = false;
  vi.stubGlobal('IntersectionObserver', class {
    private record!: Observed;
    constructor(private callback: IntersectionObserverCallback, private options: IntersectionObserverInit = {}) {}
    observe(target: Element) {
      this.record = { callback: this.callback, target, root: this.options.root, rootMargin: this.options.rootMargin, disconnected: false };
      observers.push(this.record);
      // Real observers report the initial state right away.
      if (visibleOnObserve) this.callback([{ isIntersecting: true, target } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
    }
    disconnect() { if (this.record) this.record.disconnected = true; }
    unobserve() {}
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.body.innerHTML = ''; });

const live = () => observers.filter((o) => !o.disconnected);
const scrollIntoView = () => act(() => { live().forEach((o) => o.callback([{ isIntersecting: true, target: o.target } as IntersectionObserverEntry], {} as IntersectionObserver)); });

it('requests the next page when the sentinel scrolls into view, and has no Load more button', () => {
  const fetchNextPage = vi.fn();
  render(<InfiniteScrollFooter hasNextPage isFetchingNextPage={false} fetchNextPage={fetchNextPage} />);
  expect(screen.queryByRole('button')).toBeNull();
  expect(fetchNextPage).not.toHaveBeenCalled();
  scrollIntoView();
  expect(fetchNextPage).toHaveBeenCalledTimes(1);
});

it('still attaches when the sentinel mounts after the list, which is what the old effect missed', () => {
  const fetchNextPage = vi.fn();
  // A skeleton is shown first; the sentinel only appears once a second query settles.
  function Feed() {
    const [ready, setReady] = useState(false);
    return <>
      <button onClick={() => setReady(true)}>second query settled</button>
      {ready && <InfiniteScrollFooter hasNextPage isFetchingNextPage={false} fetchNextPage={fetchNextPage} />}
    </>;
  }
  render(<Feed />);
  expect(observers).toHaveLength(0);
  fireEvent.click(screen.getByText('second query settled'));
  expect(live()).toHaveLength(1);
  scrollIntoView();
  expect(fetchNextPage).toHaveBeenCalledTimes(1);
});

it('observes the scrolling column, starting a little before the end of it', () => {
  const column = document.createElement('main');
  column.id = 'main-scroll';
  document.body.appendChild(column);
  render(<InfiniteScrollFooter hasNextPage isFetchingNextPage={false} fetchNextPage={vi.fn()} />, { container: column.appendChild(document.createElement('div')) });
  expect(live()[0].root).toBe(column);
  expect(live()[0].rootMargin).toBe('0px 0px 400px 0px');
});

it('does not ask again while a page is loading, and asks again straight after if still in view', () => {
  const fetchNextPage = vi.fn();
  visibleOnObserve = true; // a tall screen: the sentinel is already visible whenever it is observed
  const { rerender } = render(<InfiniteScrollFooter hasNextPage isFetchingNextPage={false} fetchNextPage={fetchNextPage} />);
  expect(fetchNextPage).toHaveBeenCalledTimes(1);
  rerender(<InfiniteScrollFooter hasNextPage isFetchingNextPage fetchNextPage={fetchNextPage} />);
  expect(live()).toHaveLength(0);
  expect(fetchNextPage).toHaveBeenCalledTimes(1);
  rerender(<InfiniteScrollFooter hasNextPage isFetchingNextPage={false} fetchNextPage={fetchNextPage} />);
  expect(fetchNextPage).toHaveBeenCalledTimes(2);
});

it('shows the spinner, or the caller\'s own placeholder, while loading', () => {
  const { rerender } = render(<InfiniteScrollFooter hasNextPage isFetchingNextPage fetchNextPage={vi.fn()} label="Loading more" />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading more');
  rerender(<InfiniteScrollFooter hasNextPage isFetchingNextPage fetchNextPage={vi.fn()} loading={<p>placeholder rows</p>} />);
  expect(screen.getByText('placeholder rows')).toBeInTheDocument();
});

it('stops retrying after a failed page and offers Retry, the only button it ever shows', () => {
  const fetchNextPage = vi.fn();
  render(<InfiniteScrollFooter hasNextPage isFetchingNextPage={false} isError fetchNextPage={fetchNextPage} />);
  expect(live()).toHaveLength(0);
  expect(screen.getByRole('alert')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(fetchNextPage).toHaveBeenCalledTimes(1);
});

it('renders nothing, and observes nothing, at the end of the list', () => {
  const { container } = render(<InfiniteScrollFooter hasNextPage={false} isFetchingNextPage={false} fetchNextPage={vi.fn()} />);
  expect(container).toBeEmptyDOMElement();
  expect(observers).toHaveLength(0);
});

// Guard: a Load more button must not come back.
const sources = import.meta.glob('/src/app/**/*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
it('no list in the app offers a Load more button', () => {
  const offenders = Object.entries(sources)
    .filter(([file]) => !/\.test\./.test(file))
    .filter(([, text]) => /ui\(\s*['"]Load more|>\s*Load more|'Load more (posts|comments)'/.test(text))
    .map(([file]) => file);
  expect(offenders).toEqual([]);
});
