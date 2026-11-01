import type { SentimentType } from '../../types/sentiment';
import { useUiText } from '../../i18n/uiText';
import { useApp } from '../../contexts/AppContext';
import { SENTIMENT_COLOR } from './chartTheme';

const TICKS = [-1, -0.5, 0, 0.5, 1];

export const SENTIMENT_TEXT: Record<SentimentType, string> = {
  positive: 'text-emerald-600 dark:text-emerald-400',
  neutral: 'text-amber-600 dark:text-amber-400',
  negative: 'text-red-600 dark:text-red-400',
};
const SENTIMENT_PILL: Record<SentimentType, string> = {
  positive: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  neutral: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  negative: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
};

/** Polarity on a −1…+1 scale: the signed score large, the label as a pill, and a round marker on
 * a slim three-tone track. The marker slides out from neutral once (transform only). */
export function SentimentMeter({ value, type, label }: { value: number; type: SentimentType; label: string }) {
  const ui = useUiText();
  const { t } = useApp();
  const clamped = Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0));
  const position = ((clamped + 1) / 2) * 100;
  const signed = `${clamped > 0 ? '+' : clamped < 0 ? '−' : ''}${Math.abs(clamped).toFixed(2)}`;

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${SENTIMENT_PILL[type]}`}>{label}</span>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{ui('Polarity score')}</p>
        </div>
        <p className={`text-[2rem] font-bold leading-none tabular-nums tracking-tight ${SENTIMENT_TEXT[type]}`} aria-hidden="true">
          {signed}
        </p>
      </div>

      <div className="relative mt-4 px-[9px]" role="meter" aria-valuemin={-1} aria-valuemax={1} aria-valuenow={Number(clamped.toFixed(2))} aria-valuetext={`${label}, ${clamped.toFixed(2)}`}>
        <div
          className="h-2.5 rounded-full"
          style={{ background: `linear-gradient(90deg, ${SENTIMENT_COLOR.negative} 0%, #f8b4b4 30%, #fcd34d 50%, #a7e3c8 70%, ${SENTIMENT_COLOR.positive} 100%)` }}
        />
        {/* Centre line marks neutral (0). */}
        <span aria-hidden className="absolute left-1/2 top-[-3px] h-4 w-px -translate-x-1/2 bg-slate-400/70 dark:bg-slate-500" />
        {/* Clip the translated full-width layer, with room for the marker and
            its shadow at either endpoint. It must not widen the scroll area. */}
        <div aria-hidden className="pointer-events-none absolute -inset-y-3 inset-x-0 overflow-hidden">
        <div className="absolute inset-y-3 left-[9px] right-[9px]">
          <div
            className="meter-slide absolute inset-0"
            style={{ transform: `translateX(${position}%)` }}
          >
            <span
              className="absolute left-0 top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] bg-white shadow-[0_2px_6px_rgb(15_23_42/0.25)] dark:bg-slate-900"
              style={{ borderColor: SENTIMENT_COLOR[type] }}
            />
          </div>
        </div>
        </div>
      </div>

      <div className="mt-2 flex justify-between px-[9px] text-xs tabular-nums text-slate-500 dark:text-slate-400" aria-hidden>
        {TICKS.map((tick) => <span key={tick} className="w-0 whitespace-nowrap text-center flex justify-center">{tick > 0 ? `+${tick}` : tick === 0 ? '0' : `−${Math.abs(tick)}`}</span>)}
      </div>
      <div className="mt-1 flex justify-between text-xs text-slate-500 dark:text-slate-400" aria-hidden>
        <span>{t.negative}</span><span>{t.neutral}</span><span>{t.positive}</span>
      </div>
    </div>
  );
}
