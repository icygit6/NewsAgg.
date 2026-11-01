import { useUiText } from '../../i18n/uiText';
import type { NewsArticle } from '../../types/article';
import { panelBaseClass, mutedTextClass } from './helpers';
import { PanelHeading } from '../ui/PanelHeading';
import { BookOpenText } from 'lucide-react';

export function ReadabilityPanel({ article, isDark }: { article: NewsArticle; isDark: boolean }) {
  const ui = useUiText();
  // Yahoo Taiwan publishes Chinese originals; English grade formulas are not applicable.
  const yahooTaiwan = article.source.id === 'yahoo_tw'
    || /^Yahoo\s*(?:TW|Taiwan)$/i.test(article.source.name || '')
    || /^(?:https?:\/\/)?tw\.news\.yahoo\.com(?:[/:]|$)/i.test(article.source.domain || article.url || '');
  if (yahooTaiwan) return null;
  const english = /^en(?:[-_]|$)/i.test(article.language || article.source.language || '');
  const metrics = article.readability;
  const value = (score: number | null, smog = false) => {
    if (!english) return ui('Not applicable');
    if (score === null || !Number.isFinite(score) || (smog && score <= 0)) return ui('Unavailable');
    return score.toFixed(1);
  };
  return <section className={`rounded-2xl border p-5 ${panelBaseClass()}`}>
    <PanelHeading icon={BookOpenText} isDark={isDark} className="mb-3">{ui("Readability")}</PanelHeading>
    <dl className="space-y-3 text-sm">
      <div className="flex justify-between gap-3"><dt>{ui("Reading grade")}</dt><dd>{value(metrics.fleschKincaid)}</dd></div>
      <div className="flex justify-between gap-3"><dt>{ui("Flesch score")}</dt><dd>{value(metrics.fleschScore)}</dd></div>
      <div className="flex justify-between gap-3"><dt>{ui("SMOG index")}</dt><dd>{value(metrics.smogIndex, true)}</dd></div>
    </dl>
    <p className={`mt-3 text-xs leading-relaxed ${mutedTextClass()}`}>
      {english ? ui("Calculated from the original English text, not its translation. Grade scores refer to US school levels; a higher Flesch score means easier reading. SMOG requires at least 30 sentences here. Missing scores are not zero.")
        : ui("These English-language formulas do not apply to this article’s original language. Reading time remains available.")}
    </p>
  </section>;
}
