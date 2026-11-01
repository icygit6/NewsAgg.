import { useUiText } from '../i18n/uiText';
import { useApp } from '../contexts/AppContext';
import { SentimentMeter, SENTIMENT_TEXT } from './ui/SentimentMeter';
import { SENTIMENT_COLOR } from './ui/chartTheme';
import { PanelHeading } from './ui/PanelHeading';
import { panelBaseClass } from './sentiment/shared';
import { Activity } from 'lucide-react';
import type { NewsArticle } from '../types/article';
import type { SentimentType } from '../types/sentiment';
import { RollingNumber } from './ui/RollingNumber';
import { percent } from '../hooks/useRollingNumber';
import { ArticleSentimentExplanation } from './article/ArticleSentimentExplanation';

interface ArticleSentimentPanelProps {
    article: NewsArticle;
    isDark: boolean;
}

const clampUnit = (value: number): number => Math.max(0, Math.min(1, value));

const clampSignedUnit = (value: number): number => Math.max(-1, Math.min(1, value));

export function ArticleSentimentPanel({ article, isDark }: ArticleSentimentPanelProps) {
  const ui = useUiText();
    const { t } = useApp();

    const panelBase = panelBaseClass(isDark);

    const mutedText = isDark ? 'text-slate-400' : 'text-gray-500';
    const comparative = clampSignedUnit(article.sentiment.comparative);

    const rawProbabilities = article.sentiment.probabilities;
    const positive = clampUnit(rawProbabilities.positive);
    const neutral = clampUnit(rawProbabilities.neutral);
    const negative = clampUnit(rawProbabilities.negative);
    const total = positive + neutral + negative;

    const probabilities = total > 0
        ? {
            positive: positive / total,
            neutral: neutral / total,
            negative: negative / total,
        }
        : {
            positive: 0,
            neutral: 0,
            negative: 0,
        };

    const rows: Array<{ type: SentimentType; label: string; value: number }> = [
        { type: 'positive', label: t.positive, value: probabilities.positive },
        { type: 'neutral', label: t.neutral, value: probabilities.neutral },
        { type: 'negative', label: t.negative, value: probabilities.negative },
    ];

    const top = rows.reduce((best, row) => (row.value > best.value ? row : best));

    return (
        <div className={`rounded-2xl border p-5 ${panelBase}`}>
            <PanelHeading icon={Activity} isDark={isDark} className="mb-4">{t.articleSentiment}</PanelHeading>

            <SentimentMeter value={comparative} type={article.sentiment.type} label={t[article.sentiment.type]} />

            <div className={`mt-5 border-t pt-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <h4 className="text-sm font-semibold">{ui('Why this sentiment?')} · {t[article.sentiment.type]}</h4>
                <ArticleSentimentExplanation article={article} />
            </div>

            <div className={`mt-4 border-t pt-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <p className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t.emotionBreakdown}</p>
                <div className="bar-grow mt-2 flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
                    {rows.map((row) => row.value > 0 && (
                        <div key={row.type} style={{ width: `${row.value * 100}%`, background: SENTIMENT_COLOR[row.type] }} />
                    ))}
                </div>
                <ul className="mt-3 space-y-1.5">
                    {rows.map((row) => (
                        <li key={row.type} className="flex items-center gap-2 text-xs">
                            <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SENTIMENT_COLOR[row.type] }} />
                            <span className={`flex-1 ${row.type === article.sentiment.type ? `font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}` : mutedText}`}>{row.label}</span>
                            <span className={`font-semibold tabular-nums ${SENTIMENT_TEXT[row.type]}`}>
                                <RollingNumber value={row.value * 100} format={percent(1)} />
                            </span>
                        </li>
                    ))}
                </ul>
                {/* The decision rule is ordered, so the label is not always the
                    largest probability (report §II 4.3); say so when it happens. */}
                {top.type !== article.sentiment.type && (
                    <p className={`pt-2 text-xs leading-relaxed ${mutedText}`}>{t.labelRuleNote}</p>
                )}
            </div>
        </div>
    );
}
