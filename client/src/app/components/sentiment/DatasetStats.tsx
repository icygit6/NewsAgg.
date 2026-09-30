import { useUiText } from '../../i18n/uiText';
import { useApp } from '../../contexts/AppContext';
import type { DatasetSnapshot } from '../../types/api';
import { panelBaseClass, chartMutedColor } from './shared';

interface DatasetStatsProps {
  articleCount: number;
  keywordCount: number;
  snapshot: DatasetSnapshot;
  categoryLabel: string;
}

const formatSnapshotDate = (value: string | null): string => {
  if (!value) return 'Unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

export function DatasetStats({ articleCount, keywordCount, snapshot, categoryLabel }: DatasetStatsProps) {
  const ui = useUiText();
  const { isDark } = useApp();
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
      {models.length > 0 && <details className="mt-3 text-xs">
        <summary className="cursor-pointer">{ui("Model details")}</summary>
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
