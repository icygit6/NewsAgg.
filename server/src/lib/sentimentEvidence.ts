/** Descriptive topic indicators, not an explanation of the classifier's internals.
 * Counts cover the same filtered dataset as the chart; examples are drawn from it. */
const themes = [
  ['Conflict and security', /\b(war|conflict|attack\w*|military|missile\w*|violence)\b|戰爭|衝突|襲擊|軍事|飛彈|暴力/i],
  ['Health and safety', /\b(health|disease\w*|hospital\w*|injur\w*|death\w*|died|killed|cancer)\b|健康|疾病|醫院|受傷|死亡|癌症/i],
  ['Economic conditions', /\b(econom\w*|market\w*|stock\w*|inflation|profit\w*|loss\w*|trade|jobs)\b|經濟|市場|股市|通膨|獲利|虧損|貿易/i],
  ['Sport and competition', /\b(win\w*|victory|defeat\w*|match\w*|tournament\w*|champion\w*|football|rugby)\b|獲勝|勝利|賽事|冠軍|足球|比賽/i],
  ['Climate and disasters', /\b(climate|storm\w*|flood\w*|earthquake\w*|wildfire\w*|warming)\b|氣候|颱風|洪水|地震|野火|暖化/i],
  ['Policy and public affairs', /\b(polic\w*|election\w*|parliament|minister\w*|law|court\w*|government)\b|政策|選舉|國會|部長|法院|政府/i],
  ['Research and innovation', /\b(research\w*|scient\w*|discover\w*|innovation\w*|technology|breakthrough\w*)\b|研究|科學|發現|創新|科技|突破/i],
] as const;
export const SENTIMENT_TYPES = ['positive', 'neutral', 'negative'] as const;
type Sentiment = typeof SENTIMENT_TYPES[number];
export interface EvidenceArticle { id: string; title: string; description: string | null; topic: string; sentiment_type: string; language: string | null }

export function buildSentimentEvidence(rows: EvidenceArticle[]) {
  return Object.fromEntries(SENTIMENT_TYPES.map(type => {
    const articles = rows.filter(row => row.sentiment_type === type);
    const ranked = themes.map(([label, pattern]) => ({ label, matches: articles.filter(row => pattern.test(`${row.title} ${row.description ?? ''}`)) }))
      .filter(theme => theme.matches.length > 0).sort((a, b) => b.matches.length - a.matches.length || a.label.localeCompare(b.label));
    // Database input is newest first. Prefer examples supporting the top pattern.
    const examples = (ranked[0]?.matches ?? articles).slice(0, 2).map(row => ({ id: row.id, title: row.title, language: row.language }));
    return [type, { count: articles.length, themes: ranked.slice(0, 3).map(theme => ({ label: theme.label, count: theme.matches.length })), examples }];
  })) as Record<Sentiment, { count: number; themes: { label: string; count: number }[]; examples: { id: string; title: string; language: string | null }[] }>;
}
