import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { TranslateNewsToggle } from './TranslateNewsToggle';
import { translations } from '../../i18n/translations';

const state = vi.hoisted(() => ({ newsMode: 'original' as 'original' | 'translated', setNewsMode: vi.fn() }));
vi.mock('../../contexts/AppContext', () => ({ useApp: () => ({ ...state, t: translations.en }) }));
afterEach(() => { cleanup(); state.newsMode = 'original'; vi.clearAllMocks(); });

it('is off by default and turns translation on', () => {
  render(<TranslateNewsToggle isDark={false} />);
  const toggle = screen.getByRole('switch', { name: /Translate news/ });
  expect(toggle).toHaveAttribute('aria-checked', 'false');
  expect(toggle).toHaveTextContent('stay in the language they were published in');
  fireEvent.click(toggle);
  expect(state.setNewsMode).toHaveBeenCalledWith('translated');
});

it('turns translation back off', () => {
  state.newsMode = 'translated';
  render(<TranslateNewsToggle isDark={false} />);
  const toggle = screen.getByRole('switch', { name: /Translate news/ });
  expect(toggle).toHaveAttribute('aria-checked', 'true');
  fireEvent.click(toggle);
  expect(state.setNewsMode).toHaveBeenCalledWith('original');
});
