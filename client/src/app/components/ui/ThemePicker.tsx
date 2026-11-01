import { useId, useState } from 'react';
import { Check, ChevronDown, Moon, Palette, Save, Sun, Trash2 } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useUiText } from '../../i18n/uiText';
import { SegmentedControl } from './SegmentedControl';
import { THEMES, isCanvas, setTheme, useTheme, type Canvas, type ThemeId } from '../../lib/theme';
import { readableAccent } from '../../lib/readableColour';

// canvas is missing on themes saved before the custom background could be picked.
interface SavedTheme { key: string; name: string; id: ThemeId; custom: string; canvas?: Canvas; dark: boolean }
const savedKey = 'newsagg-saved-themes';
function readSaved(): SavedTheme[] {
  try {
    const values: unknown = JSON.parse(localStorage.getItem(savedKey) || '[]');
    return Array.isArray(values) ? values.filter(item => item && typeof item.key === 'string' && typeof item.name === 'string' && typeof item.dark === 'boolean' && /^#[0-9a-f]{6}$/i.test(item.custom) && (item.canvas === undefined || isCanvas(item.canvas)) && (item.id === 'custom' || THEMES.some(theme => theme.id === item.id))).slice(0, 12) : [];
  } catch { return []; }
}

/** Light or dark, plus a colour template (each has a light and a dark face). Signed-in readers
 * can also pick their own colours and save themes. Used in the account drawer, the nav rail's
 * theme menu and on the profile page. collapsible folds the custom colour and saved themes
 * behind a Customise toggle, so the account drawer stays short. */
export function ThemePicker({ collapsible = false }: { collapsible?: boolean }) {
  const ui = useUiText();
  const nameId = useId();
  const { isDark, toggleTheme, user } = useApp();
  const theme = useTheme();
  const [customising, setCustomising] = useState(!collapsible || theme.id === 'custom');
  const [saved, setSaved] = useState(readSaved);
  const [name, setName] = useState('');
  const [notice, setNotice] = useState('');
  const persist = (items: SavedTheme[]) => {
    try { localStorage.setItem(savedKey, JSON.stringify(items)); setSaved(items); return true; }
    catch { setNotice(ui('Your browser could not save this theme.')); return false; }
  };
  const save = () => {
    if (!name.trim()) return;
    const existing = saved.find(item => item.name.toLowerCase() === name.trim().toLowerCase());
    if (!existing && saved.length >= 12) { setNotice(ui('Remove a saved theme before adding another.')); return; }
    const item = { key: existing?.key ?? crypto.randomUUID(), name: name.trim(), ...theme, dark: isDark };
    if (persist(existing ? saved.map(value => value.key === existing.key ? item : value) : [...saved, item])) {
      setName(''); setNotice(ui('Theme saved on this browser.'));
    }
  };

  const customActive = theme.id === 'custom';
  // What the reader last picked, before the theme limited it for readability. The hidden colour
  // inputs keep this value so the native picker doesn't jump while they drag; the pill shows the
  // colour actually in use.
  const [picked, setPicked] = useState<{ accent?: string; canvas?: string; canvasDark?: boolean }>({});
  const canvasNow = theme.canvas[isDark ? 1 : 0];
  const pickedCanvas = picked.canvasDark === isDark ? picked.canvas : undefined;
  const adjusted = (picked.accent !== undefined && picked.accent !== theme.custom)
    || (pickedCanvas !== undefined && pickedCanvas !== canvasNow);
  const pickAccent = (hex: string) => {
    setPicked(value => ({ ...value, accent: hex.toLowerCase() }));
    setTheme('custom', hex);
  };
  const pickCanvas = (hex: string) => {
    setPicked(value => ({ ...value, canvas: hex.toLowerCase(), canvasDark: isDark }));
    const canvas: Canvas = isDark ? [theme.canvas[0], hex] : [hex, theme.canvas[1]];
    setTheme('custom', undefined, canvas);
  };
  // Same split pill as the template tiles; each half is a colour input of its own.
  const half = 'relative cursor-pointer [&:has(:focus-visible)]:outline-2 [&:has(:focus-visible)]:-outline-offset-4 [&:has(:focus-visible)]:outline-white';
  const swatchInput = 'absolute inset-0 h-full w-full cursor-pointer opacity-0';

  return (
    <div className="space-y-3">
      <SegmentedControl
        label={ui('Mode')}
        value={isDark ? 'dark' : 'light'}
        onChange={toggleTheme}
        options={[
          { value: 'light', label: <><Sun size={16} />{ui('Light')}</> },
          { value: 'dark', label: <><Moon size={16} />{ui('Dark')}</> },
        ]}
      />

      <div role="radiogroup" aria-label={ui('Colour theme')} className="grid grid-cols-3 gap-x-2 gap-y-3">
        {THEMES.map((item) => {
          const active = theme.id === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(item.id)}
              className={`group flex min-h-14 flex-col items-center gap-1.5 rounded-2xl p-1.5 text-xs font-medium transition-colors ${
                active ? 'text-[var(--brand)] dark:text-white' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <span aria-hidden className={`relative flex h-9 w-14 overflow-hidden rounded-full ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ${active ? 'ring-[var(--brand)]' : 'ring-transparent'}`}>
                <span className="flex-1" style={{ background: item.canvas[isDark ? 1 : 0] }} />
                <span className="w-1/2" style={{ background: item.swatch }} />
                {active && <Check size={14} className="absolute right-1 top-1 rounded-full bg-white p-0.5 text-slate-900" />}
              </span>
              {item.label}
            </button>
          );
        })}
      </div>

      {user && collapsible && (
        <button
          type="button"
          aria-expanded={customising}
          onClick={() => setCustomising(open => !open)}
          className="flex w-full items-center gap-2 rounded-xl px-1 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <Palette size={14} aria-hidden />
          <span className="flex-1 text-left">{ui('Customise')}</span>
          <ChevronDown size={14} aria-hidden className={`transition-transform duration-200 ${customising ? 'rotate-180' : ''}`} />
        </button>
      )}

      {user && customising && <>
      <div className={`flex items-center gap-2 rounded-2xl py-1.5 pl-1.5 pr-2.5 text-sm transition-colors ${customActive ? 'bg-[var(--brand-soft)]' : 'bg-slate-50 dark:bg-slate-800'}`}>
        <button
          type="button"
          aria-pressed={customActive}
          onClick={() => setTheme('custom')}
          className="flex min-h-11 flex-1 items-center gap-3 rounded-xl px-1.5 text-left"
        >
          <Palette size={16} className="shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
          <span className="font-medium text-slate-700 dark:text-slate-200">{ui('Your own colour')}</span>
        </button>
        <span className={`relative flex h-9 w-14 shrink-0 overflow-hidden rounded-full ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ${customActive ? 'ring-[var(--brand)]' : 'ring-slate-200 dark:ring-slate-700'}`}>
          <label className={`${half} flex-1`} style={{ background: canvasNow }} title={ui('Background colour')}>
            <input type="color" value={pickedCanvas ?? canvasNow} onChange={(event) => pickCanvas(event.target.value)} aria-label={ui('Background colour')} className={swatchInput} />
          </label>
          <label className={`${half} w-1/2`} style={{ background: theme.custom }} title={ui('Accent colour')}>
            <input type="color" value={picked.accent ?? theme.custom} onChange={(event) => pickAccent(event.target.value)} aria-label={ui('Accent colour')} className={swatchInput} />
          </label>
          {customActive && <Check size={14} aria-hidden className="pointer-events-none absolute right-1 top-1 rounded-full bg-white p-0.5 text-slate-900" />}
        </span>
      </div>
      {adjusted && <p role="status" className="-mt-1 px-1 text-xs text-slate-500 dark:text-slate-400">{ui('Adjusted so text stays readable.')}</p>}
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400" htmlFor={nameId}>{ui('Save your theme')}</label>
        <div className="flex gap-2">
          <input id={nameId} value={name} maxLength={40} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); save(); } }} placeholder={ui('Theme name')} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-700" />
          <button
            type="button"
            disabled={!name.trim()}
            onClick={save}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-transparent disabled:text-slate-400 disabled:ring-1 disabled:ring-inset disabled:ring-slate-200 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 dark:disabled:bg-transparent dark:disabled:text-slate-500 dark:disabled:ring-slate-700"
          >
            <Save size={16} aria-hidden />{ui('Save')}
          </button>
        </div>
        <p role="status" className="text-xs text-slate-500">{notice || ui('Saved on this browser.')}</p>
        {saved.map(item => <div key={item.key} className="flex items-center gap-2">
          <button type="button" onClick={() => { setTheme(item.id, item.custom, item.canvas); if (isDark !== item.dark) toggleTheme(); }} className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800">
            <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: item.id === 'custom' ? readableAccent(item.custom) : THEMES.find(theme => theme.id === item.id)?.swatch }} />
            <span className="truncate">{item.name}</span>{item.dark ? <Moon size={14} /> : <Sun size={14} />}
          </button>
          <button type="button" aria-label={`${ui('Delete')} ${item.name}`} title={ui('Delete')} onClick={() => persist(saved.filter(value => value.key !== item.key))} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"><Trash2 size={16} aria-hidden /></button>
        </div>)}
      </div>
      </>}
    </div>
  );
}
