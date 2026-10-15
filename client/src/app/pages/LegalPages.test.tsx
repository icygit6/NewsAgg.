import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { PrivacyPage, EditorialPolicyPage } from './LegalPages';
import { UiLocaleContext } from '../i18n/uiText';
const state = vi.hoisted(() => ({ language: 'en', isDark: false }));
vi.mock('../contexts/AppContext', () => ({ useApp: () => state }));
afterEach(() => { cleanup(); state.language = 'en'; });
it('discloses personalization, external deletion boundaries and data controls', () => {
  render(<MemoryRouter><PrivacyPage /></MemoryRouter>);
  expect(screen.getByText(/Disabling personalization does not itself erase/)).toBeInTheDocument();
  expect(screen.getByText(/Clear Mem0 reading interests separately/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Research evidence' })).toHaveAttribute('href', '/insights?view=research');
});
it('provides Chinese corrections policy without claiming guaranteed factual truth', () => {
  state.language = 'zhTW';
  render(<MemoryRouter><UiLocaleContext.Provider value="zhTW"><EditorialPolicyPage /></UiLocaleContext.Provider></MemoryRouter>);
  expect(screen.getByRole('heading', { name: '編輯與更正政策' })).toBeInTheDocument();
  expect(screen.getByText(/無法保證完全沒有不實新聞/)).toBeInTheDocument();
  expect(screen.getByText(/高一致度無法證明獨立作答/)).toBeInTheDocument();
});
