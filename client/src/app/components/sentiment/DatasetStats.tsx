import { useUiText } from '../../i18n/uiText';
import { ChevronDown } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import type { DatasetSnapshot } from '../../types/api';
import { panelBaseClass, chartMutedColor } from './shared';
import { formatNewsDate } from '../../lib/formatDate';

interface DatasetStatsProps {
  articleCount: number;
  keywordCount: number;
  snapshot: DatasetSnapshot;
  categoryLabel: string;
}


export function DatasetStats({ articleCount, keywordCount, snapshot, categoryLabel }: DatasetStatsProps) {
  const ui = useUiText();
  const { isDark, language } = useApp();
  const formatSnapshotDate = (value: string | null): string =>
    value ? formatNewsDate(value, language, true) : ui('Unavailable');
  const mutedColor = chartMutedColor(isDark);
  const models = snapshot.nlpModels ?? [];
  const modelCount = new Set(models.map(model => model.id)).size;
  const lastScrapedLabel = formatSnapshotDate(snapshot.scrapedAt);

  return (
    <div className={`rounded-2xl border shadow-lg p-4 ${panelBaseClass(isDark)}`}>
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-xl p-2.5 ${isDark ? 'bg-slate-700/50' : 'bg-gray-50/90'}`}>
          <p className="text-xs" style={{ color: mutedColor }}>{ui("Articles")}</p>
          <p className="text-lg font-bold text-cyan-500">{articleCount}</p>
        </div>
        <div className={`rounded-xl p-2.5 ${isDark ? 'bg-slate-700/50' : 'bg-gray-50/90'}`}>
          <p className="text-xs" style={{ color: mutedColor }}>{ui("Keywords tracked")}</p>
          <p className="text-lg font-bold text-violet-500">{keywordCount}</p>
        </div>
        <div className={`rounded-xl p-2.5 ${isDark ? 'bg-slate-700/50' : 'bg-gray-50/90'}`}>
          <p className="text-xs" style={{ color: mutedColor }}>{ui("Sources")}</p>
          <p className="text-lg font-bold text-emerald-500">{snapshot.sourceCount}</p>
        </div>
        <div className={`rounded-xl p-2.5 ${isDark ? 'bg-slate-700/50' : 'bg-gray-50/90'}`}>
          <p className="text-xs" style={{ color: mutedColor }}>{ui("NLP pipeline models")}</p>
          <p className="text-lg font-bold text-amber-500">{modelCount || '—'}</p>
        </div>
      </div>
      <p className="text-[11px] mt-2" style={{ color: mutedColor }}>{ui("Published dataset (")}{categoryLabel})
      </p>
      {models.length > 0 && <details className={`group mt-3 rounded-xl border px-3 py-2 text-xs ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
        <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-2 font-semibold [&::-webkit-details-marker]:hidden">
          {ui("Model details")}
          <ChevronDown size={14} className="shrink-0 transition-transform group-open:rotate-180" style={{ color: mutedColor }} />
        </summary>
        <p className="my-2" style={{ color: mutedColor }}>{ui("Configured pipeline; models vary by article language and task. Chat and translation services are not included.")}</p>
        <ul className="space-y-2">{models.map(model => <li key={model.id}>
          <span className="font-semibold">{ui(model.role)}</span><br />
          <span className="break-all" style={{ color: mutedColor }}>{model.id}</span>
        </li>)}</ul>
      </details>}
      <p className="text-[11px] mt-1" style={{ color: mutedColor }}>{ui("Last scraped:")} {lastScrapedLabel}
      </p>
    </div>
  );
}
