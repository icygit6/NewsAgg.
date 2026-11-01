import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

const app = vi.hoisted(() => ({ user: null as null | { id: number; username: string } }));
vi.mock('../../contexts/AppContext', () => ({ useApp: () => ({ isDark: false, toggleTheme: () => {}, user: app.user }) }));

import { ThemePicker } from './ThemePicker';

afterEach(() => { cleanup(); app.user = null; });

it('offers signed-out visitors the templates only', () => {
  render(<ThemePicker />);
  expect(screen.getByRole('radio', { name: /Sand/ })).toBeTruthy();
  expect(screen.queryByText('Your own colour')).toBeNull();
  expect(screen.queryByLabelText('Accent colour')).toBeNull();
  expect(screen.queryByPlaceholderText('Theme name')).toBeNull();
});

it('adds custom colours and saved themes once signed in', () => {
  app.user = { id: 1, username: 'reader' };
  render(<ThemePicker />);
  expect(screen.getByLabelText('Background colour')).toBeTruthy();
  expect(screen.getByLabelText('Accent colour')).toBeTruthy();
  expect(screen.getByPlaceholderText('Theme name')).toBeTruthy();
});

it('folds custom colours and saved themes away when collapsible', () => {
  app.user = { id: 1, username: 'reader' };
  render(<ThemePicker collapsible />);
  const toggle = screen.getByRole('button', { name: 'Customise' });
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(screen.queryByLabelText('Accent colour')).toBeNull();
  fireEvent.click(toggle);
  expect(screen.getByLabelText('Accent colour')).toBeTruthy();
  expect(screen.getByPlaceholderText('Theme name')).toBeTruthy();
});

it('says so when a picked colour is adjusted for readability', () => {
  app.user = { id: 1, username: 'reader' };
  render(<ThemePicker />);
  expect(screen.queryByText('Adjusted so text stays readable.')).toBeNull();
  fireEvent.input(screen.getByLabelText('Accent colour'), { target: { value: '#ffffff' } });
  expect(screen.getByText('Adjusted so text stays readable.')).toBeTruthy();
});
