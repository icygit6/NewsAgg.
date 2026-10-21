import { DATA_MODES, currentDataMode, setDataMode } from './dataMode';

const LABEL: Record<string, string> = { demo: 'Demo data', worst: 'Worst case', empty: 'Empty', one: 'One', many: '1,000 rows' };

/** Dev-only stress-data switch. Deliberately plain and unthemed: it is chrome
 * for the person testing, not part of the design under test. */
export function DataModeToggle() {
  if (!import.meta.env.DEV) return null;
  const mode = currentDataMode();
  return (
    <div
      style={{
        position: 'fixed',
        // Clear of the bottom tab bar, which owns the bottom-centre of the
        // viewport below lg — otherwise this swallows taps meant for the nav.
        bottom: 'calc(5.25rem + env(safe-area-inset-bottom, 0px))',
        left: '50%', transform: 'translateX(-50%)',
        zIndex: 2147483647, display: 'flex', gap: 2, padding: 3, borderRadius: 999,
        background: '#e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,.2)', opacity: 0.94,
        font: '500 12px system-ui, sans-serif',
      }}
    >
      {DATA_MODES.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setDataMode(option)}
          style={{
            border: 0, cursor: 'pointer', borderRadius: 999, padding: '4px 10px', font: 'inherit',
            background: option === mode ? '#fff' : 'transparent',
            color: option === mode ? '#0f172a' : '#475569',
          }}
        >
          {LABEL[option]}
        </button>
      ))}
    </div>
  );
}
