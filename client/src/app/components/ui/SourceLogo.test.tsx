import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { SourceLogo } from './SourceLogo';

afterEach(cleanup);

it('serves a known publisher icon from the site, then falls back to theirs, then to a monogram', () => {
  const { container } = render(<SourceLogo source={{ id: 'bbc', name: 'BBC', domain: 'bbc.com', logo: 'https://www.bbc.com/favicon.ico' }} isDark={false} />);
  const img = () => container.querySelector('img');
  expect(img()).toHaveAttribute('src', '/source-logos/bbc.png');
  fireEvent.error(img()!);
  expect(img()).toHaveAttribute('src', 'https://www.bbc.com/favicon.ico');
  fireEvent.error(img()!);
  expect(img()?.getAttribute('src')).toContain('google.com/s2/favicons?domain=bbc.com');
  fireEvent.error(img()!);
  expect(img()).toBeNull();
  expect(container.textContent).toBe('B');
});

it('keeps a white disc behind publisher marks in dark mode, where a black logo would vanish', () => {
  const { container } = render(<SourceLogo source={{ id: 'bbc', name: 'BBC' }} isDark />);
  expect(container.querySelector('img')).toHaveClass('bg-white');
});

it('does not invent a local icon for an unknown publisher', () => {
  const { container } = render(<SourceLogo source={{ name: 'Example Times', domain: 'example.test' }} isDark={false} />);
  expect(container.querySelector('img')?.getAttribute('src')).toContain('domain=example.test');
});
