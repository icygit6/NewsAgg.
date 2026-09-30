import { useUiText } from '../../i18n/uiText';
import { LineChart as LineChartIcon } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useMarkets } from '../../hooks/useStats';

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
        stroke={up ? '#10b981' : '#f43f5e'}
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
        up ? 'text-emerald-600 bg-emerald-500/10' : 'text-rose-600 bg-rose-500/10'
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

  if (isLoading || !data) return null;
  const anyStale = Boolean(data.fx.stale || data.indices.stale || data.crypto.stale);
  const unavailableLabel =
    language === 'zhTW' ? '資料暫時無法取得' : 'Data temporarily unavailable';
  const disclaimer =
    language === 'zhTW' ? '延遲資料，僅供參考' : 'Delayed data — informational only';
  const asOfLabel = language === 'zhTW' ? '資料截至' : 'As of';
  const locale = language === 'zhTW' ? 'zh-TW' : language === 'zhCN' ? 'zh-CN' : language === 'id' ? 'id-ID' : 'en-US';

  const row = `flex items-center justify-between gap-2 py-1.5`;
  const label = `text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`;
  const value = `text-xs font-semibold tabular-nums ${isDark ? 'text-slate-100' : 'text-slate-900'}`;

  return (
    <div
      className={`rounded-2xl border p-4 ${
        isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--brand-grad, #2563eb)' }}
        >
          <LineChartIcon size={13} className="text-white" />
        </div>
        <h3
          className={`font-poppins text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}
        >
          {t.markets}
        </h3>
        {anyStale && (
          <span
            className={`ml-auto text-[10px] uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
          >
            {t.delayedData}
          </span>
        )}
      </div>

      {!data.fx.unavailable && (
        <div className={`border-b pb-1 mb-1 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
          <div className={row}>
            <span className={label}>USD / IDR</span>
            <span className={value}>{nf.format(data.fx.idr)}</span>
          </div>
          <div className={row}>
            <span className={label}>USD / TWD</span>
            <span className={value}>{nf2.format(data.fx.twd)}</span>
          </div>
          <p className={`pb-1 text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            <a
              href="https://www.exchangerate-api.com"
              target="_blank"
              rel="noreferrer"
              className="underline decoration-dotted underline-offset-2 hover:text-[var(--brand)]"
            >{ui("Rates by ExchangeRate-API")} </a>{' '}
            · {asOfLabel} {formatAsOf(data.fx.updatedAt, locale)}
          </p>
        </div>
      )}

      {data.indices.items.map((ix) => (
        <div key={ix.symbol} className={row}>
          <span className={label}>
            <span className="block">{ix.name}</span>
            <span className={`block text-[9px] font-normal ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
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
        <p className={`py-2 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {unavailableLabel} {ui("— US indices")} </p>
      )}

      {data.crypto.items.map((c) => (
        <div key={c.id} className={row}>
          <span className={label}>
            <span className="block">{c.symbol}</span>
            <span className={`block text-[9px] font-normal ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
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
        <p className={`py-2 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {unavailableLabel} {ui("— cryptocurrency")} </p>
      )}
      <p className={`mt-2 text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
        {disclaimer}
      </p>
    </div>
  );
}
