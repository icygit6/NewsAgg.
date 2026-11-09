import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { ReportingAuthors } from './ReportingAuthors';

vi.mock('../../contexts/AppContext', () => ({ useApp: () => ({ language: 'en' }) }));
vi.mock('../../i18n/uiText', () => ({ useUiText: () => (text: string) => text }));
vi.mock('../ui/AutoPages', () => ({ AutoPages: ({ items }: { items: unknown[] }) => <div data-testid="rows">{items as never}</div> }));
afterEach(cleanup);

const authors = [
  ...Array.from({ length: 12 }, (_, n) => ({ name: `Reporter ${n + 1}`, source: 'BBC', count: 20 - n, articleId: `a${n}` })),
  { name: '王小明', source: 'Yahoo Taiwan', count: 3, articleId: 'tw1' },
];
const rows = () => screen.queryAllByRole('link').map(link => link.textContent);

it('narrows the bylines by author or publisher as you type, and clears back to all', () => {
  render(<MemoryRouter><ReportingAuthors authors={authors} total={100} /></MemoryRouter>);
  const search = screen.getByRole('searchbox', { name: 'Find an author or publisher' });
  expect(rows()).toHaveLength(13);
  fireEvent.change(search, { target: { value: 'reporter 1' } });
  expect(rows().map(row => row?.split('BBC')[0])).toEqual(['Reporter 1', 'Reporter 10', 'Reporter 11', 'Reporter 12']);
  fireEvent.change(search, { target: { value: 'yahoo' } });
  expect(rows()).toEqual([expect.stringContaining('王小明')]);
  fireEvent.change(search, { target: { value: '小明' } });
  expect(rows()).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
  expect(rows()).toHaveLength(13);
});

it('says so when nothing matches, and skips the box for a short list', () => {
  render(<MemoryRouter><ReportingAuthors authors={authors} total={100} /></MemoryRouter>);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'nobody' } });
  expect(screen.getByRole('status')).toHaveTextContent('No authors or publishers match this search.');
  cleanup();
  render(<MemoryRouter><ReportingAuthors authors={authors.slice(0, 3)} total={10} /></MemoryRouter>);
  expect(screen.queryByRole('searchbox')).toBeNull();
});
