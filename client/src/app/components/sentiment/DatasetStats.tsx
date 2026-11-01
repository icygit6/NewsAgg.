import { useUiText } from '../../i18n/uiText';
import { useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Cpu, Languages, Layers, ChevronDown } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import type { DatasetSnapshot } from '../../types/api';
import { panelBaseClass, chartMutedColor } from './shared';
import { formatNewsDate } from '../../lib/formatDate';
import { RollingNumber } from '../ui/RollingNumber';

/** Counts roll in (preview C1); a dash stays a dash. */
const RollingNumberOrText = ({ value }: { value: number | string }) =>
  typeof value === 'number' ? <RollingNumber value={value} /> : <>{value}</>;

interface DatasetStatsProps {
  expanded?: boolean;
  /** Insights page: `stats` is a one-line summary strip, `models` a flat card. */
  part?: 'stats' | 'models';
  articleCount: number;
  keywordCount: number;
  snapshot: DatasetSnapshot;
  categoryLabel: string;
}


export function DatasetStats({ articleCount, keywordCount, snapshot, categoryLabel, expanded = false, part }: DatasetStatsProps) {
  const ui = useUiText();
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const reducedMotion = useReducedMotion();
  const { isDark, language } = useApp();
  const formatSnapshotDate = (value: string | null): string =>
    value ? formatNewsDate(value, language, true) : ui('Unavailable');
  const mutedColor = chartMutedColor(isDark);
  const models = snapshot.nlpModels ?? [];
  const services = snapshot.serviceModels ?? [];
  const modelCount = new Set(models.map(model => model.id)).size;
  const lastScrapedLabel = formatSnapshotDate(snapshot.scrapedAt);
  const groups = [{ title: ui('NLP pipeline models'), items: models, Icon: Layers }, { title: ui('Translation and AI chat'), items: services, Icon: Languages }].filter(group => group.items.length);

  if (part === 'stats') {
    const stats: [string, number | string][] = [[ui('Articles'), articleCount], [ui('Keywords tracked'), keywordCount], [ui('Sources'), snapshot.sourceCount], [ui('NLP pipeline models'), modelCount || '—']];
    return (
      <section aria-label={`${ui('Published dataset (')}${categoryLabel})`} className={`rounded-2xl border px-4 py-3 ${panelBaseClass(isDark)}`}>
        <dl className={`grid grid-cols-2 gap-y-3 sm:grid-cols-4 sm:divide-x ${isDark ? 'divide-slate-700' : 'divide-slate-200'}`}>
          {stats.map(([label, value]) => <div key={label} className="min-w-0 sm:px-4 sm:first:pl-0">
            <dt className="text-xs" style={{ color: mutedColor }}>{label}</dt>
            <dd className={`mt-0.5 text-xl font-bold tabular-nums ${isDark ? 'text-slate-50' : 'text-slate-900'}`}><RollingNumberOrText value={value} /></dd>
          </div>)}
        </dl>
        <p className="mt-2 text-xs" style={{ color: mutedColor }}>{ui('Published dataset (')}{categoryLabel}) · {ui('Last scraped:')} {lastScrapedLabel}</p>
      </section>
    );
  }

  if (part === 'models') return models.length > 0 ? (
    <div className={`rounded-2xl border p-4 ${panelBaseClass(isDark)}`}>
      <h3 className={`flex items-center gap-2 font-poppins text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-gray-800'}`}><Cpu size={18} className="text-[var(--brand)]" />{ui('Model details')}</h3>
      <p className="mt-1 text-xs leading-relaxed" style={{ color: mutedColor }}>{ui('Configured pipeline; models vary by article language and task.')}</p>
      {groups.map(({ title, items, Icon }) => <div key={title} className="mt-4">
        <h4 className="flex items-center gap-2 text-xs font-semibold"><Icon size={14} className="text-[var(--brand)]" />{title}</h4>
        <ul className={`mt-1 divide-y ${isDark ? 'divide-slate-700/60' : 'divide-slate-200/70'}`}>
          {items.map(model => <li key={`${model.role}-${model.id}`} className="min-w-0 py-2.5">
            <p className="text-xs font-semibold">{ui(model.role)}</p>
            <p className="mt-0.5 break-words text-xs leading-relaxed [overflow-wrap:anywhere]" style={{ color: mutedColor }}>{model.id}</p>
          </li>)}
        </ul>
      </div>)}
    </div>
  ) : null;

  return (
    <div className={`rounded-2xl border p-4 ${panelBaseClass(isDark)}`}>
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-xl p-3 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
          <p className="text-xs" style={{ color: mutedColor }}>{ui("Articles")}</p>
          <p className={`mt-0.5 text-xl font-bold ${isDark ? 'text-slate-50' : 'text-slate-900'}`}><RollingNumberOrText value={articleCount} /></p>
        </div>
        <div className={`rounded-xl p-3 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
          <p className="text-xs" style={{ color: mutedColor }}>{ui("Keywords tracked")}</p>
          <p className={`mt-0.5 text-xl font-bold ${isDark ? 'text-slate-50' : 'text-slate-900'}`}><RollingNumberOrText value={keywordCount} /></p>
        </div>
        <div className={`rounded-xl p-3 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
          <p className="text-xs" style={{ color: mutedColor }}>{ui("Sources")}</p>
          <p className={`mt-0.5 text-xl font-bold ${isDark ? 'text-slate-50' : 'text-slate-900'}`}><RollingNumberOrText value={snapshot.sourceCount} /></p>
        </div>
        <div className={`rounded-xl p-3 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
          <p className="text-xs" style={{ color: mutedColor }}>{ui("NLP pipeline models")}</p>
          <p className={`mt-0.5 text-xl font-bold ${isDark ? 'text-slate-50' : 'text-slate-900'}`}><RollingNumberOrText value={modelCount || '—'} /></p>
        </div>
      </div>
      <p className="text-xs mt-2" style={{ color: mutedColor }}>{ui("Published dataset (")}{categoryLabel})
      </p>
      {models.length > 0 && <section className="mt-4 overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--brand)_20%,transparent)]">
        {expanded ? <h3 className="flex items-center gap-2 px-4 pt-4 text-sm font-semibold"><Cpu size={18} className="text-[var(--brand)]" />{ui("Model details")}</h3> :
          <button type="button" aria-expanded={open} aria-controls={detailsId} onClick={() => setOpen(value => !value)}
            className="flex min-h-12 w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold transition-colors hover:bg-[color-mix(in_srgb,var(--brand)_8%,transparent)] focus-visible:outline-2 focus-visible:outline-[var(--brand)]">
            <Cpu size={18} className="text-[var(--brand)]" /><span className="flex-1">{ui("Model details")}</span>
            <span className="rounded-full bg-[color-mix(in_srgb,var(--brand)_10%,transparent)] px-2 py-0.5 text-xs text-[var(--brand)]">{modelCount}</span>
            <ChevronDown size={16} className={`transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
          </button>}
        <AnimatePresence initial={false}>
          {(expanded || open) && <motion.div id={detailsId} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: reducedMotion ? 0 : 0.2, ease: [0.23, 1, 0.32, 1] }} className="overflow-hidden">
            <div className="space-y-4 px-4 pb-4 pt-2">
              <p className="text-xs leading-relaxed" style={{ color: mutedColor }}>{ui("Configured pipeline; models vary by article language and task.")}</p>
              {groups.map(({title, items, Icon}) =>
                <div key={title}>
                  <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold"><Icon size={14} className="text-[var(--brand)]" />{title}</h4>
                  <ul className={`divide-y rounded-xl px-3 ${isDark ? 'divide-slate-700/60 bg-slate-800/60' : 'divide-slate-200/60 bg-slate-50'}`}>
                    {items.map(model => <li key={`${model.role}-${model.id}`} className="min-w-0 py-3">
                      <p className="text-xs font-semibold">{ui(model.role)}</p>
                      <p className="mt-1 break-words text-xs leading-relaxed [overflow-wrap:anywhere]" style={{ color: mutedColor }}>{model.id}</p>
                    </li>)}
                  </ul>
                </div>)}
            </div>
          </motion.div>}
        </AnimatePresence>
      </section>}
      <p className="text-xs mt-1" style={{ color: mutedColor }}>{ui("Last scraped:")} {lastScrapedLabel}
      </p>
    </div>
  );
}
