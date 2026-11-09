import { useUiText } from '../../i18n/uiText';
import { useState } from 'react';
import { Link } from 'react-router';
import { ExternalLink, PlayCircle, ChevronDown, Info } from 'lucide-react';
import type { NewsArticle } from '../../types/article';
import { useApp } from '../../contexts/AppContext';
import { panelBaseClass } from './helpers';
import { SourceLogo } from '../ui/SourceLogo';

interface ArticleFooterProps {
  article: NewsArticle;
  isDark: boolean;
}

export function ArticleFooter({ article, isDark }: ArticleFooterProps) {
  const ui = useUiText();
  const { t } = useApp();
  const panelBase = panelBaseClass();
  const [open, setOpen] = useState(false);

  const glossary: Array<{ term: string; desc: string }> = [
    { term: t.toxicityTerm, desc: t.toxicityDesc },
    { term: t.readingGradeTerm, desc: t.readingGradeDesc },
    { term: t.fleschTerm, desc: t.fleschDesc },
    { term: t.smogTerm, desc: t.smogDesc },
  ];

  const mutedText = 'text-slate-500 dark:text-slate-400';
  const headingText = 'text-slate-900 dark:text-slate-100';

  return (
    <>
    {/* The actions live in the bar under the title; the end of the story only
        says where it came from and points to the full version. */}
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5 dark:border-slate-700/60">
      <div className="flex min-w-0 items-center gap-2.5">
        <SourceLogo source={article.source} isDark={isDark} className="h-8 w-8" />
        <p className="min-w-0 text-sm text-slate-600 dark:text-slate-300">{ui('Story from')} <span className="font-semibold text-slate-900 dark:text-slate-100">{article.source.name}</span></p>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {article.videoUrl && (
          <a href={article.videoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
            <PlayCircle size={16} aria-hidden="true" />{ui('Watch video')}</a>
        )}
        <a href={article.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand)] hover:underline">
          {ui('Read the full story on')} {article.source.name}<ExternalLink size={15} aria-hidden="true" />
        </a>
      </div>
    </div>

    <div className={`rounded-2xl border p-5 ${panelBase}`}>
      {/* Metric glossary + sentiment math (collapsible) */}
      <div>
        <button
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex items-center justify-between w-full text-left"
        >
          <span className={`flex items-center gap-2 font-poppins text-sm font-semibold ${headingText}`}>
            <Info size={14} className="text-blue-600 dark:text-blue-400" />
            {t.metricsGlossaryTitle}
          </span>
          <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''} ${mutedText}`} />
        </button>

        {open && (
          <div className="mt-4 space-y-4">
            <div className="space-y-3">
              {glossary.map((item) => (
                <div key={item.term}>
                  <p className={`text-sm font-semibold text-slate-800 dark:text-slate-200`}>{item.term}</p>
                  <p className={`text-xs leading-relaxed ${mutedText}`}>{item.desc}</p>
                </div>
              ))}
            </div>

            {/* How sentiment is decided — mirrors scraper/core/nlp.py _classify */}
            <div className={`rounded-xl p-4 bg-slate-50 dark:bg-slate-900/40`}>
              <p className={`font-poppins text-sm font-semibold mb-2 text-slate-800 dark:text-slate-200`}>{t.sentimentMathTitle}</p>
              <p className={`text-xs leading-relaxed mb-3 ${mutedText}`}>{t.sentimentMathDesc}</p>
              <ul className={`space-y-1 text-xs font-mono text-slate-700 dark:text-slate-300`}>
                <li>polarity = P({t.positive}) − P({t.negative})</li>
                <li>{t.neutral}: P({t.neutral}) ≥ 0.52 &amp; |polarity| ≤ 0.18</li>
                <li>{t.positive}: polarity ≥ +0.10</li>
                <li>{t.negative}: polarity ≤ −0.10</li>
                <li>{t.sentimentFallbackRule}</li>
              </ul>
              <Link to="/methodology" className="mt-3 inline-block text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                {t.methodologyTitle} →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
