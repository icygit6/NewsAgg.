import { Link } from 'react-router';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useUiPunctuation, useUiText } from '../../i18n/uiText';
import { useTitleTranslations } from '../../hooks/useTitleTranslations';
import type { SentimentEvidence } from '../../hooks/useStats';
import { SENTIMENT_COLOR } from '../ui/chartTheme';
import { ArticleSentimentExplanation } from '../article/ArticleSentimentExplanation';

const TYPES = ['positive', 'neutral', 'negative'] as const;
type Type = typeof TYPES[number];
const DESCRIPTION: Record<Type, string> = {
  positive: 'Positive labels generally indicate favourable language or outcomes.',
  neutral: 'Neutral labels generally indicate factual, mixed or weak sentiment signals.',
  negative: 'Negative labels generally indicate adverse language or outcomes.',
};

function Examples({ examples }: { examples: SentimentEvidence['positive']['examples'] }) {
  const { isDark } = useApp();
  const translated = useTitleTranslations(examples);
  return <ul className="mt-2 space-y-2">{translated.map(article => <li key={article.id}><Link className={`block rounded py-1 text-xs leading-relaxed underline-offset-2 hover:underline [overflow-wrap:anywhere] ${isDark ? 'text-blue-300' : 'text-blue-700'}`} to={`/article/${encodeURIComponent(article.id)}`}>{article.title}</Link></li>)}</ul>;
}

/** One sentiment at a time behind tabs. The caveats that apply to every tab
 * are stated once above them instead of being repeated per sentiment. */
function ReasonTabs({ evidence, total, initial }: { evidence: SentimentEvidence; total: number; initial: Type }) {
  const ui = useUiText();
  const p = useUiPunctuation();
  const { t, isDark } = useApp();
  const id = useId();
  const [active, setActive] = useState<Type>(initial);
  const tabs = useRef<Partial<Record<Type, HTMLButtonElement | null>>>({});
  const group = evidence[active];
  const muted = isDark ? 'text-slate-400' : 'text-slate-600';
  const move = (event: KeyboardEvent, index: number) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = TYPES[(index + step + TYPES.length) % TYPES.length];
    setActive(next);
    tabs.current[next]?.focus();
  };
  const why = group.examples.length > 0 && <>
    <p className="mt-3 font-semibold">{ui('Why this sentiment?')}</p>
    <ArticleSentimentExplanation key={group.examples[0].id} article={{ id: group.examples[0].id }} compact showNote={false} />
  </>;
  const examples = group.examples.length > 0 && <>
    <p className="mt-3 font-semibold">{ui('Supporting examples')}</p>
    <Examples examples={group.examples} />
  </>;
  return <>
    <p className={muted}>{ui('Themes are detected in original headlines and summaries. They describe coverage, not the model’s internal reasoning or proof of why a label was assigned. Themes may overlap; examples are not the full dataset.')} {ui('Based on the first supporting article below, not every article in this group.')} {ui('AI interpretation of the article’s content; not the original classifier’s internal reasoning.')}</p>
    <div role="tablist" aria-label={ui('Reasons and examples')} className="mt-3 grid grid-cols-3 gap-1.5">
      {TYPES.map((type, index) => <button key={type} ref={el => { tabs.current[type] = el; }} type="button" role="tab"
        id={`${id}-${type}`} aria-selected={active === type} aria-controls={`${id}-panel`} tabIndex={active === type ? 0 : -1}
        onClick={() => setActive(type)} onKeyDown={event => move(event, index)}
        className="min-h-11 min-w-0 rounded-lg border px-2 py-1.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-[var(--brand)]"
        style={active === type ? { borderColor: SENTIMENT_COLOR[type], background: `color-mix(in srgb, ${SENTIMENT_COLOR[type]} 10%, transparent)` } : { borderColor: isDark ? '#334155' : '#e2e8f0' }}>
        <span className="flex items-center gap-1.5 font-semibold" style={{ color: SENTIMENT_COLOR[type] }}><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: SENTIMENT_COLOR[type] }} />{t[type]}</span>
        <span className={`block tabular-nums ${muted}`}>{evidence[type].count.toLocaleString()} · {total ? Math.round(evidence[type].count / total * 100) : 0}%</span>
      </button>)}
    </div>
    <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${active}`} className="mt-3">
      <p>{ui(DESCRIPTION[active])}</p>
      <p className="mt-1">{group.count === 0 ? ui('No articles match this sentiment.') : group.themes.length ? <>{ui('Detected coverage')}{p.colon}{group.themes.map(theme => `${ui(theme.label)}${p.open}${theme.count.toLocaleString()}${p.close}`).join(' · ')}{p.stop}</> : ui('No recurring theme was detected reliably; inspect the examples for context.')}</p>
      {why}
      {examples}
    </div>
  </>;
}

/**
 * Pattern summary plus per-sentiment reasons. `show="all"` (sidebars) keeps
 * the reasons behind a disclosure; `show="open"` (Insights) always shows them.
 */
export function SentimentReasons({ evidence, onOpenChange, show = 'all' }: { show?: 'all' | 'open'; evidence?: SentimentEvidence; onOpenChange?: (open: boolean) => void }) {
  const ui = useUiText();
  const p = useUiPunctuation();
  const { t, isDark, selectedSentiments = [], selectedSentiment = 'all' } = useApp();
  const [open, setOpen] = useState(false);
  if (!evidence) return null;
  const total = TYPES.reduce((sum, type) => sum + evidence[type].count, 0);
  const largest = Math.max(...TYPES.map(type => evidence[type].count));
  const leaders = TYPES.filter(type => evidence[type].count === largest);
  const dominant = leaders[0];
  const dominantTheme = evidence[dominant].themes[0];
  const tabs = <ReasonTabs evidence={evidence} total={total} initial={dominant} />;
  return <div className="mt-3 min-w-0 border-t border-current/10 pt-3 text-xs leading-relaxed [overflow-wrap:anywhere]" data-testid="sentiment-reasons">
    <p className="font-semibold">{ui('Pattern summary')}</p>
    {total === 0 ? <p className="mt-1">{ui('No articles match these filters.')}</p> : <>
      <p className="mt-1">{leaders.length === 1 ? <>{ui('Largest share')}{p.colon}<strong>{t[dominant]}{p.open}{Math.round(largest / total * 100)}%{p.close}</strong>{p.stop}{dominantTheme && <>{ui('Most frequent detected theme in this group')}{p.colon}{ui(dominantTheme.label)}{p.open}{dominantTheme.count.toLocaleString()} {ui('articles')}{p.close}{p.stop}</>}</> : <>{ui('Equal largest shares')}{p.colon}{leaders.map(type => t[type]).join(' / ')}{p.open}{Math.round(largest / total * 100)}%{p.close}{p.stop}</>}</p>
      {(selectedSentiments.length > 0 || selectedSentiment !== 'all') && <p className="mt-2 font-medium">{ui('Sentiment filters are active; these percentages describe only the selected sentiments.')}</p>}
      {show === 'all' && <details open={open} onToggle={event => { const next = event.currentTarget.open; setOpen(next); onOpenChange?.(next); }} className="mt-2">
        <summary className={`min-h-11 cursor-pointer py-3 font-semibold ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>{ui('View reasons and examples')}</summary>
        {open && tabs}
      </details>}
      {show === 'open' && <section className="mt-4">
        <h4 className="mb-2 text-sm font-semibold">{ui('Reasons and examples')}</h4>
        {tabs}
      </section>}
    </>}
  </div>;
}
