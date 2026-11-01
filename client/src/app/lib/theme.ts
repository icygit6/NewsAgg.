import { useSyncExternalStore } from 'react';
import { readableAccent, readableCanvas } from './readableColour';

/** Colour templates the team provides; each has a light and a dark face (styles/themes.css). */
export const THEMES = [
  { id: 'newsagg', label: 'NewsAgg', swatch: '#2563eb', canvas: ['#f3f6fa', '#0b1220'] },
  { id: 'sand', label: 'Sand', swatch: '#70665b', canvas: ['#f7f2ea', '#141110'] },
  { id: 'forest', label: 'Graphite', swatch: '#475569', canvas: ['#f3f5f8', '#0d121a'] },
  { id: 'ocean', label: 'Steel', swatch: '#486a8a', canvas: ['#f1f5fa', '#0c1420'] },
  { id: 'grape', label: 'Grape', swatch: '#7c3aed', canvas: ['#f5f3fc', '#100c1b'] },
  { id: 'rose', label: 'Indigo', swatch: '#4f46e5', canvas: ['#f5f5fc', '#101020'] },
] as const;
export type ThemeId = (typeof THEMES)[number]['id'] | 'custom';

const THEME_KEY = 'newsagg-theme';
const CUSTOM_KEY = 'newsagg-theme-custom';
const CANVAS_KEYS = ['newsagg-theme-custom-light', 'newsagg-theme-custom-dark'] as const;
const DEFAULT_CUSTOM = '#0891b2';
const DEFAULT_CANVAS: Canvas = ['#f6f7f9', '#0b0f17'];
const HEX = /^#[0-9a-f]{6}$/i;

/** Page background for the custom theme: [light, dark], like a template's two faces. */
export type Canvas = readonly [string, string];
interface ThemeState { id: ThemeId; custom: string; canvas: Canvas }

export const isCanvas = (value: unknown): value is Canvas =>
  Array.isArray(value) && value.length === 2 && value.every((hex) => typeof hex === 'string' && HEX.test(hex));

/** Custom colours as the app uses them: limited so its fixed text colours stay readable. */
export const readableCustom = (custom: string, canvas: Canvas) => ({
  custom: readableAccent(custom),
  canvas: [readableCanvas(canvas[0], false), readableCanvas(canvas[1], true)] as Canvas,
});

function save({ id, custom, canvas }: ThemeState) {
  try {
    localStorage.setItem(THEME_KEY, id);
    localStorage.setItem(CUSTOM_KEY, custom);
    CANVAS_KEYS.forEach((key, i) => localStorage.setItem(key, canvas[i]));
  } catch { /* private mode: keep it for this visit */ }
}

function read(): ThemeState {
  try {
    const id = localStorage.getItem(THEME_KEY) as ThemeId | null;
    const custom = localStorage.getItem(CUSTOM_KEY) ?? DEFAULT_CUSTOM;
    const canvas = CANVAS_KEYS.map((key, i) => localStorage.getItem(key) ?? DEFAULT_CANVAS[i]);
    const known = id === 'custom' || THEMES.some((theme) => theme.id === id);
    const loaded: ThemeState = {
      id: known && id ? id : 'newsagg',
      ...readableCustom(HEX.test(custom) ? custom : DEFAULT_CUSTOM, isCanvas(canvas) ? canvas : DEFAULT_CANVAS),
    };
    // Colours stored before the limits existed: store the readable ones, so the boot script in
    // index.html paints those from the next load on.
    if (id === 'custom' && (loaded.custom !== custom.toLowerCase() || loaded.canvas.some((hex, i) => hex !== canvas[i]?.toLowerCase()))) save(loaded);
    return loaded;
  } catch {
    return { id: 'newsagg', custom: DEFAULT_CUSTOM, canvas: DEFAULT_CANVAS };
  }
}

let state = read();
const listeners = new Set<() => void>();

/** Puts the theme on <html>; the matching rules live in styles/themes.css. */
export function applyTheme({ id, custom, canvas }: ThemeState = state) {
  const root = document.documentElement;
  // The boot script paints <html> directly; from here on body uses var(--page-bg).
  root.style.removeProperty('background');
  if (id === 'newsagg') delete root.dataset.theme; else root.dataset.theme = id;
  const vars = { '--theme-custom': custom, '--theme-custom-canvas': canvas[0], '--theme-custom-canvas-dark': canvas[1] };
  Object.entries(vars).forEach(([name, value]) => {
    if (id === 'custom') root.style.setProperty(name, value); else root.style.removeProperty(name);
  });
  const dark = root.classList.contains('dark');
  const background = (THEMES.find((item) => item.id === id)?.canvas ?? canvas)[dark ? 1 : 0];
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => { meta.content = background; });
}

export function setTheme(id: ThemeId, custom?: string, canvas?: Canvas) {
  state = {
    id,
    ...readableCustom(custom && HEX.test(custom) ? custom : state.custom, isCanvas(canvas) ? canvas : state.canvas),
  };
  save(state);
  applyTheme(state);
  listeners.forEach((listener) => listener());
}

export const getTheme = (): ThemeState => state;

export function useTheme(): ThemeState {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    () => state,
    () => state,
  );
}
