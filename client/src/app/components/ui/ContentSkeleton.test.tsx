import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router';
import { FeedSkeleton } from './ContentSkeleton';
import { RouteFallback } from '../RouteFallback';
afterEach(cleanup);
it('also renders safely before the router and runtime config are initialized', () => {
  render(<RouteFallback />);
  expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
});

it('matches the responsive feed and hides decorative blocks from assistive technology', () => {
  const { container } = render(<FeedSkeleton count={3} label="Loading stories" />);
  expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  expect(container.querySelector('[class*="@5xl:grid-cols-3"]')).not.toBeNull();
  expect(container.querySelectorAll('.motion-safe\\:animate-pulse').length).toBeGreaterThan(3);
});
it.each([['/insights', 'Loading insights'], ['/article/123', 'Loading article'], ['/profile', 'Loading content']])('uses the matching route fallback for %s', (path, label) => {
  render(<MemoryRouter initialEntries={[path]}><RouteFallback /></MemoryRouter>);
  expect(screen.getByRole('status')).toHaveAttribute('aria-label', label);
});
