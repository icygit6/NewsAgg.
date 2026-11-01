import { render } from '@testing-library/react';
import { Clock3 } from 'lucide-react';
import { expect, it } from 'vitest';
import { PanelIcon } from './PanelIcon';

it('is drawn like InsightMark: a theme-coloured line icon with no tile, hidden from assistive technology', () => {
  const { container } = render(<PanelIcon icon={Clock3} />);
  const mark = container.firstElementChild as HTMLElement;
  expect(mark).toHaveClass('h-8', 'w-8', 'text-[var(--brand)]');
  expect(mark.className).not.toMatch(/\bbg-|rounded/);
  expect(mark).toHaveAttribute('aria-hidden', 'true');
  expect(mark.querySelector('svg')).not.toBeNull();
});

// Guard: Sentiment Distribution, Live View, Trending Topics, Live Engagement, Markets and the
// rest each had their own gradient. A panel must use PanelIcon rather than draw its own tile.
const sources = import.meta.glob('/src/app/components/{sentiment,widgets}/*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

it('no panel draws its own icon tile', () => {
  const offenders = Object.entries(sources)
    .filter(([file]) => !/\.test\./.test(file))
    .filter(([, text]) => /w-6 h-6 rounded-lg/.test(text))
    .map(([file]) => file);
  expect(offenders).toEqual([]);
});

// The analytics panels (Sentiment Distribution, Sentiment by category, Live View, Trending,
// Markets) use the drawn InsightMark; only these panels keep an icon tile.
it('every panel that has an icon tile imports PanelIcon', () => {
  const users = Object.entries(sources).filter(([, text]) => /<PanelIcon /.test(text));
  expect(users.map(([file]) => file.split('/').pop()).sort()).toEqual([
    'LiveEngagement.tsx',
  ]);
});
