import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { PrivacyPage, EditorialPolicyPage } from './LegalPages';
import { UiLocaleContext } from '../i18n/uiText';
const state = vi.hoisted(() => ({ language: 'en', isDark: false }));
vi.mock('../contexts/AppContext', () => ({ useApp: () => state }));
afterEach(() => { cleanup(); state.language = 'en'; });
it('discloses external deletion boundaries and data controls', () => {
  render(<MemoryRouter><PrivacyPage /></MemoryRouter>);
  expect(screen.getByText(/Deletion does not prove removal from external provider logs/)).toBeInTheDocument();
  expect(screen.queryByText(/Mem0/)).toBeNull();
  expect(screen.getByRole('link', { name: 'Research & tests' })).toHaveAttribute('href', '/insights?view=research');
});
it('provides Chinese corrections policy without claiming guaranteed factual truth', () => {
  state.language = 'zhTW';
  render(<MemoryRouter><UiLocaleContext.Provider value="zhTW"><EditorialPolicyPage /></UiLocaleContext.Provider></MemoryRouter>);
  expect(screen.getByRole('heading', { name: '編輯與更正政策' })).toBeInTheDocument();
  expect(screen.getByText(/無法保證完全沒有不實新聞/)).toBeInTheDocument();
  expect(screen.getByText(/高一致度無法證明獨立作答/)).toBeInTheDocument();
});
