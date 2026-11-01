import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ t: { search: 'Search', searchPlaceholder: 'Search news' }, isDark: false, searchQuery: '', setSearchQuery: vi.fn() }),
}));
import { SearchBox } from './SearchBox';

afterEach(cleanup);

it('takes focus when opened from the desktop Search button, so typing goes straight in', () => {
  render(<MemoryRouter><SearchBox autoFocus /></MemoryRouter>);
  expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveFocus();
});

it('leaves focus alone where the box is always on screen (no surprise phone keyboard)', () => {
  render(<MemoryRouter><SearchBox /></MemoryRouter>);
  expect(screen.getByRole('searchbox', { name: 'Search' })).not.toHaveFocus();
});
