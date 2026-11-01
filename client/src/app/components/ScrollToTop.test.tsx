import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, useNavigate, useLocation } from 'react-router';
import { ScrollToTop } from './ScrollToTop';

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  return <><main id="main-scroll"><p>{location.pathname}</p></main>
    <button onClick={() => navigate('/article/test')}>Article</button>
    <button onClick={() => navigate('/profile')}>Profile</button>
    <button onClick={() => navigate(-1)}>Back</button><ScrollToTop /></>;
}
beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  HTMLElement.prototype.scrollTo = vi.fn(function(this: HTMLElement, options: ScrollToOptions | number = {}) {
    this.scrollTop = typeof options === 'number' ? options : options.top ?? 0;
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('restores listing position only when going Back from an article', () => {
  render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
  const main = document.getElementById('main-scroll')!;
  main.scrollTop = 1850;
  fireEvent.scroll(main);
  fireEvent.click(screen.getByText('Article'));
  expect(main.scrollTop).toBe(0);
  fireEvent.click(screen.getByText('Back'));
  expect(main.scrollTop).toBe(1850);
  fireEvent.click(screen.getByText('Profile'));
  expect(main.scrollTop).toBe(0);
  main.scrollTop = 500;
  fireEvent.scroll(main);
  fireEvent.click(screen.getByText('Back'));
  expect(main.scrollTop).toBe(0);
});
