import { afterEach, expect, it } from 'vitest';
import { setTheme } from './theme';

afterEach(() => { setTheme('newsagg'); document.documentElement.classList.remove('dark'); });

it('puts a template on <html>, remembers it, and the default leaves no attribute', () => {
  setTheme('sand');
  expect(document.documentElement.dataset.theme).toBe('sand');
  expect(localStorage.getItem('newsagg-theme')).toBe('sand');
  setTheme('newsagg');
  expect(document.documentElement.dataset.theme).toBeUndefined();
});

it('applies a custom colour and ignores anything that is not a 6-digit hex', () => {
  setTheme('custom', '#c2410c');
  expect(document.documentElement.style.getPropertyValue('--theme-custom')).toBe('#c2410c');
  setTheme('custom', 'red; background:url(x)');
  expect(document.documentElement.style.getPropertyValue('--theme-custom')).toBe('#c2410c');
});

it('keeps a custom background for each mode and ignores invalid ones', () => {
  setTheme('custom', '#c2410c', ['#fff8f0', '#1a1008']);
  const style = document.documentElement.style;
  expect(style.getPropertyValue('--theme-custom-canvas')).toBe('#fff8f0');
  expect(style.getPropertyValue('--theme-custom-canvas-dark')).toBe('#1a1008');
  expect(localStorage.getItem('newsagg-theme-custom-dark')).toBe('#1a1008');
  setTheme('custom', undefined, ['#fff', 'url(x)'] as unknown as [string, string]);
  expect(style.getPropertyValue('--theme-custom-canvas')).toBe('#fff8f0');
  setTheme('sand');
  expect(style.getPropertyValue('--theme-custom-canvas')).toBe('');
});

it('keeps custom colours readable but leaves sensible ones alone', () => {
  setTheme('custom', '#ffffff', ['#000000', '#ffffff']);
  const style = document.documentElement.style;
  const accent = style.getPropertyValue('--theme-custom');
  const lum = (hex: string) => {
    const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const n = parseInt(hex.slice(1), 16);
    return 0.2126 * lin((n >> 16 & 255) / 255) + 0.7152 * lin((n >> 8 & 255) / 255) + 0.0722 * lin((n & 255) / 255);
  };
  expect(1.05 / (lum(accent) + 0.05)).toBeGreaterThanOrEqual(4.5);
  expect(lum(style.getPropertyValue('--theme-custom-canvas'))).toBeGreaterThan(0.8);
  expect(lum(style.getPropertyValue('--theme-custom-canvas-dark'))).toBeLessThan(0.05);
  setTheme('custom', '#2563EB', ['#fdf2f4', '#2a0d16']);
  expect(style.getPropertyValue('--theme-custom')).toBe('#2563eb');
  expect(style.getPropertyValue('--theme-custom-canvas')).toBe('#fdf2f4');
  expect(style.getPropertyValue('--theme-custom-canvas-dark')).toBe('#2a0d16');
});
