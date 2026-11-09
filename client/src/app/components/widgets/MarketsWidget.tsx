import { useUiText } from '../../i18n/uiText';
import { useState } from 'react';
import { SkeletonBlock } from '../ui/ContentSkeleton';
import { StyledSelect } from '../ui/StyledSelect';
import { InsightMark } from '../ui/InsightMark';
import { useApp } from '../../contexts/AppContext';
import { useMarkets } from '../../hooks/useStats';
import { SENTIMENT_COLOR } from '../ui/chartTheme';
import { LoadError } from '../ui/ErrorNote';

/** Tiny dependency-free sparkline (recharts would drag ~300kB into the shell
 * bundle for a 60×20 line). */
function Sparkline({ points, up }: { points: number[]; up: boolean }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const w = 64;
  const h = 20;
  const path = points
    .map(
      (p, i) =>
        `${((i / (points.length - 1)) * w).toFixed(1)},${(h - ((p - min) / span) * h).toFixed(1)}`,
    )
    .join(' ');
  return (
    <svg width={w} height={h} className="shrink-0" aria-hidden>
      <polyline
        points={path}
        fill="none"
        stroke={up ? SENTIMENT_COLOR.positive : SENTIMENT_COLOR.negative}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DeltaChip({ pct }: { pct: number | null }) {
  if (pct == null) return null;
  const up = pct >= 0;
  return (
    <span
      className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${
        up ? 'text-emerald-600 bg-emerald-500/10' : 'text-red-600 bg-red-500/10'
      }`}
    >
      {up ? '+' : ''}
      {pct.toFixed(2)}%
    </span>
  );
}

const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

function formatAsOf(value: string | null, locale: string) {
  if (!value) return 'unknown';
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const parsed = new Date(dateOnly ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    ...(dateOnly ? {} : { timeStyle: 'short' as const }),
  }).format(parsed);
}

/** Market snapshot for the Business view: USD exchange rates (IDR/TWD), US
 * indices and BTC/ETH — all server-cached keyless upstreams. */
export function MarketsWidget() {
  const ui = useUiText();
  const { isDark, t, language } = useApp();
  const { data, isLoading } = useMarkets();

  const [pair, setPair] = useState(() => {
    try {
      const value = JSON.parse(localStorage.getItem('newsagg-currency-pair') || 'null');
      if (Array.isArray(value) && value.length === 2 && value.every(code => typeof code === 'string' && /^[A-Z]{3}$/.test(code))) return value as string[];
    } catch { /* use the default pair */ }
    return ['USD', 'TWD'];
  });
  const changePair = (index: number, code: string) => {
    const next = pair.map((value, i) => i === index ? code : value);
    setPair(next);
    try { localStorage.setItem('newsagg-currency-pair', JSON.stringify(next)); } catch { /* session-only */ }
  };
  if (isLoading) return <div role="status" aria-label={t.loading} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><SkeletonBlock className="h-6 w-32" /><SkeletonBlock className="h-16 w-full" /><SkeletonBlock className="h-24 w-full" /></div>;
  if (!data) return <div className="rounded-2xl border p-4"><LoadError message={ui('Market data is temporarily unavailable.')} /></div>;
  const rates: Record<string, number> = { USD: 1, IDR: data.fx.idr, TWD: data.fx.twd, EUR: data.fx.eur, ...data.fx.rates };
  const currencies = Object.keys(rates).filter(code => Number.isFinite(rates[code]) && rates[code] > 0).sort();
  const base = currencies.includes(pair[0]) ? pair[0] : 'USD';
  const quote = currencies.includes(pair[1]) ? pair[1] : 'TWD';

  const anyStale = Boolean(data.fx.stale || data.indices.stale || data.crypto.stale);
  const unavailableLabel =
    language === 'zhTW' ? '資料暫時無法取得' : 'Data temporarily unavailable';
  const disclaimer =
    language === 'zhTW' ? '延遲資料，僅供參考' : 'Delayed data — informational only';
  const asOfLabel = language === 'zhTW' ? '資料截至' : 'As of';
  const locale = language === 'zhTW' ? 'zh-TW' : 'en-US';

  const row = `flex items-center justify-between gap-2 py-1.5`;
  const label = `text-xs font-medium text-slate-600 dark:text-slate-300`;
  const value = `text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100`;

  return (
    <div
      className={`rounded-2xl border p-4 bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800`}
    >
      <div className="flex items-center gap-2 mb-2">
        <InsightMark kind="trending" />
        <h3
          className={`font-poppins text-sm font-semibold text-slate-800 dark:text-slate-200`}
        >
          {t.markets}
        </h3>
        {anyStale && (
          <span
            className={`ml-auto text-xs text-slate-500 dark:text-slate-400`}
          >
            {t.delayedData}
          </span>
        )}
      </div>

      {!data.fx.unavailable && (
        <div className={`border-b pb-1 mb-1 border-slate-100 dark:border-slate-800`}>
          <div className="grid grid-cols-2 gap-2 py-2">
            {[base, quote].map((code, index) => <label key={index} className="min-w-0 text-xs text-slate-500">
              {ui(index === 0 ? 'From currency' : 'To currency')}
              <StyledSelect value={code} onChange={value => changePair(index, value)}
                options={currencies.map(currency => ({ value: currency, label: currency }))}
                label={ui(index === 0 ? 'From currency' : 'To currency')} isDark={isDark} className="mt-1" />
            </label>)}
          </div>
          <p className="py-2 text-sm font-semibold tabular-nums">1 {base} = {new Intl.NumberFormat(locale, { maximumSignificantDigits: 6 }).format(rates[quote] / rates[base])} {quote}</p>
          <p className={`pb-1 text-xs text-slate-400 dark:text-slate-500`}>
            <a
              href="https://www.exchangerate-api.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[var(--brand)]"
            >{ui("Rates by ExchangeRate-API")} </a>{' '}
            · {asOfLabel} {formatAsOf(data.fx.updatedAt, locale)}
          </p>
        </div>
      )}

      {data.indices.items.map((ix) => (
        <div key={ix.symbol} className={row}>
          <span className={label}>
            <span className="block">{ix.name}</span>
            <span className={`block text-xs font-normal text-slate-400 dark:text-slate-500`}>
              {ix.provider} · {asOfLabel} {formatAsOf(ix.asOf, locale)}
            </span>
          </span>
          <div className="flex items-center gap-2">
            <Sparkline points={ix.spark} up={(ix.changePct ?? 0) >= 0} />
            <span className={value}>{nf2.format(ix.close)}</span>
            <DeltaChip pct={ix.changePct} />
          </div>
        </div>
      ))}

      {data.indices.unavailable && (
        <p className={`py-2 text-xs text-slate-400 dark:text-slate-500`}>
          {unavailableLabel} {ui("— US indices")} </p>
      )}

      {data.crypto.items.map((c) => (
        <div key={c.id} className={row}>
          <span className={label}>
            <span className="block">{c.symbol}</span>
            <span className={`block text-xs font-normal text-slate-400 dark:text-slate-500`}>
              {c.provider} · {asOfLabel} {formatAsOf(c.asOf, locale)}
            </span>
          </span>
          <div className="flex items-center gap-2">
            <Sparkline points={c.spark} up={(c.changePct24h ?? 0) >= 0} />
            <span className={value}>${nf.format(c.price)}</span>
            <DeltaChip pct={c.changePct24h} />
          </div>
        </div>
      ))}

      {data.crypto.unavailable && (
        <p className={`py-2 text-xs text-slate-400 dark:text-slate-500`}>
          {unavailableLabel} {ui("— cryptocurrency")} </p>
      )}
      <p className={`mt-2 text-xs text-slate-400 dark:text-slate-600`}>
        {disclaimer}
      </p>
    </div>
  );
}
