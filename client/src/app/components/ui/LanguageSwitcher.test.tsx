import { afterEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { translations } from '../../i18n/translations';
const state = vi.hoisted(() => ({ setLanguage: vi.fn() }));
vi.mock('../../contexts/AppContext', () => ({ useApp: () => ({ ...state, t: translations.en }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('selects an article target without changing the website locale', () => {
  const onSelectLanguage = vi.fn();
  render(<LanguageSwitcher isDark={false} selectedLanguage="en" onSelectLanguage={onSelectLanguage} />);
  fireEvent.click(screen.getByText('繁中'));
  expect(onSelectLanguage).toHaveBeenCalledWith('zhTW');
  expect(state.setLanguage).not.toHaveBeenCalled();
});
