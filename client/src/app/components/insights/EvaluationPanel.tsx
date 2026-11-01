import { useUiText } from '../../i18n/uiText';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowDownToLine, FlaskConical, BookOpen } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import data from '../../data/evaluation.json';
import dataUrl from '../../data/evaluation.json?url';
import { ResearchMethods } from './ResearchMethods';
import { VerificationResults } from './VerificationResults';
import { ResearchReferences } from './ResearchReferences';
import './evidence.css';

type Task = 'sentiment' | 'topic';
type Metric = typeof data.references[number]['tasks']['sentiment'];
type Score = Pick<Metric, 'n' | 'matches' | 'agreement' | 'macroF1' | 'kappa'>;
export type EvidenceText = (en: string, zh: string) => string;
const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
const dec = (n: number | null) => n === null ? '—' : n.toFixed(4);
const sources: Record<string, string> = { bbc: 'BBC', cnn: 'CNN', aljazeera: 'Al Jazeera', yahoo_tw: 'Yahoo Taiwan', en: 'English', 'zh-TW': '繁體中文' };
const labelsZh: Record<string, string> = { positive: '正面', neutral: '中性', negative: '負面', Sport: '體育', Health: '健康', Business: '商業', World: '國際', Politics: '政治', Lifestyle: '生活', Science: '科學', Climate: '氣候' };

export function EvidenceTable({ caption, headers, children }: { caption: string; headers: string[]; children: ReactNode }) {
  return <div className="evidence-table-wrap" tabIndex={0} role="region" aria-label={caption}>
    <table><caption>{caption}</caption><thead><tr>{headers.map(h => <th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table>
  </div>;
}
function Scores({ score }: { score: Score }) {
  return <><td>{score.matches}/{score.n}</td><td>{pct(score.agreement)}</td><td>{dec(score.macroF1)}</td><td>{dec(score.kappa)}</td></>;
}

export function EvaluationPanel() {
  const ui = useUiText();
  const { language, isDark } = useApp();
  const zh = language === 'zhTW';
  const tx: EvidenceText = (en, cn) => zh ? cn : en;
  const label = (s: string) => zh ? labelsZh[s] ?? sources[s] ?? s : sources[s] ?? s;
  const name = (id: string) => {
    const r = data.references.find(x => x.id === id)!;
    return r.kind === 'human' ? tx(r.name, `人工 ${r.name.slice(-1)}`) : r.name;
  };
  const [view, setView] = useState('results');
  const [task, setTask] = useState<Task>('sentiment');
  const [reference, setReference] = useState('human-a');
  const selected = data.references.find(r => r.id === reference)!;
  const metric = selected.tasks[task];
  const unanimous = data.humanUnanimity[task];
  const scoreHeaders = [ui('Matches / n'), ui('Agreement'), 'Macro F1', 'Cohen κ'];
  const tabs = [
    ['results', ui('Evaluation')], ['pairs', ui('Human & AI comparisons')],
    ['methods', ui('Models & calculations')], ['tests', ui('Verification')],
    ['references', ui('Glossary & references')],
  ];

  return <section id="research" className={`evidence mt-8 ${isDark ? 'evidence-dark' : ''}`} aria-labelledby="research-title">
    <div className="evidence-heading">
      <div><p className="evidence-eyebrow"><FlaskConical size={16} aria-hidden /> {ui('Research notebook')}</p>
        <h2 id="research-title">{ui('Behind the analysis')}</h2>
        <p>{ui('A frozen evaluation sample, with traceable calculations and test evidence.')}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <a className="evidence-download" href="/research-foundations.html"><BookOpen size={16} aria-hidden />{ui('Research foundations')}</a>
        <a className="evidence-download" href={dataUrl} download="NewsAgg-evaluation-2026-10-15.json"><ArrowDownToLine size={16} aria-hidden />{ui('Download aggregate JSON')}</a>
      </div>
    </div>
    <div className="evidence-kpis">
      {[[String(data.sampleN), ui('unique articles')], ['4 + 2', ui('human + AI references')], [String(data.humanDisagreementUnion), ui('articles needing adjudication')], [data.date, ui('evaluation snapshot · Taipei')]].map(([value, caption]) => <div key={caption}><strong>{value}</strong><span>{caption}</span></div>)}
    </div>
    <p className="evidence-notice">{ui('Interim reference agreement, not final accuracy. No adjudicated gold labels exist yet. This 120-article snapshot is separate from the live feed and does not change with its category filter.')}</p>
    <div className="evidence-tabs" aria-label={ui('Research sections')}>
      {tabs.map(([id, title]) => <button type="button" key={id} aria-pressed={view === id} onClick={() => setView(id)}>{title}</button>)}
    </div>

    {(view === 'results' || view === 'pairs') && <div className="evidence-controls">
      {/* Visible choices instead of native selects: two tasks as a segmented
          switch, six references as grouped chips. */}
      <div className="evidence-control">
        <span id="evidence-task-label">{ui('Task')}</span>
        <div className="evidence-segment" role="group" aria-labelledby="evidence-task-label">
          {([['sentiment', ui('Sentiment · 3 classes')], ['topic', ui('Topic · 8 classes')]] as const).map(([value, title]) =>
            <button type="button" key={value} aria-pressed={task === value} onClick={() => setTask(value)}>{title}</button>)}
        </div>
      </div>
      {view === 'results' && <div className="evidence-control">
        <span id="evidence-reference-label">{ui('Reference for details')}</span>
        <div className="evidence-chips" role="group" aria-labelledby="evidence-reference-label">
          {(['human', 'ai'] as const).map(kind => <div key={kind} className="evidence-chip-group">
            <small>{kind === 'human' ? ui('Human') : ui('AI reference')}</small>
            {data.references.filter(r => (r.kind === 'human') === (kind === 'human')).map(r =>
              <button type="button" key={r.id} aria-pressed={reference === r.id} onClick={() => setReference(r.id)}>{name(r.id)}</button>)}
          </div>)}
        </div>
      </div>}
    </div>}

    {view === 'results' && <div className="evidence-body">
      <div className="evidence-grid">
        <div className="evidence-card"><h3>{ui('NewsAgg vs each reference')}</h3>
          <p>{ui('Macro F1 · equal weight per class · scale 0–1')}</p>
          <div className="evidence-bars">{data.references.map(r => <div className="evidence-bar-row" key={r.id}>
            <span>{name(r.id)}</span><div className="evidence-bar-track"><div className={r.kind === 'human' ? 'evidence-bar-human' : 'evidence-bar-ai'} style={{ width: `${r.tasks[task].macroF1 * 100}%` }} /></div><b>{dec(r.tasks[task].macroF1)}</b>
          </div>)}</div>
          <p className="evidence-legend">{ui('Blue: human reference · violet: AI reference. Exact values below.')}</p>
        </div>
        <div className="evidence-card"><h3>{ui('Sample & disagreement')}</h3>
          <p>{ui('30 articles per publisher; 90 English and 30 Traditional Chinese. These are published articles, so rejected scraping candidates are not evaluated.')}</p>
          <div className="evidence-unanimity"><strong>{unanimous.unanimous}/120</strong><span>{ui('four-human unanimous labels')}</span></div>
          <div className="evidence-stacked" aria-label={`${unanimous.unanimous}/120`}><div style={{ width: `${unanimous.unanimous / 1.2}%` }} /></div>
          <p>{tx(`${unanimous.disagreements} disagreements for this task. Across both tasks, 93 unique articles require review; do not add the two task counts together.`, `此任務有 ${unanimous.disagreements} 篇分歧。兩項任務合計 93 篇不同文章待討論，不應直接相加兩項分歧數。`)}</p>
        </div>
      </div>
      <EvidenceTable caption={ui('System-to-reference scores')} headers={[tx('Reference', '參考標註'), ...scoreHeaders]}>
        {data.references.map(r => <tr key={r.id}><th scope="row">{name(r.id)} <small>{r.kind === 'human' ? ui('human') : ui('AI reference')}</small></th><Scores score={r.tasks[task]} /></tr>)}
      </EvidenceTable>
      <div className="evidence-card">
        <h3>{ui('Confusion matrix')} · {name(reference)}</h3>
        <p>{ui('Rows = reference labels. Columns = NewsAgg predictions. Diagonal cells are matches; every cell is an article count.')}</p>
        <EvidenceTable caption={`${name(reference)} → NewsAgg`} headers={[ui('Reference ↓ / NewsAgg →'), ...metric.labels.map(label)]}>
          {metric.matrix.map((row, i) => <tr key={metric.labels[i]}><th scope="row">{label(metric.labels[i])}</th>{row.map((count, j) => <td key={j} className={i === j ? 'evidence-diagonal' : ''}>{count}</td>)}</tr>)}
        </EvidenceTable>
        <EvidenceTable caption={ui('Per-class calculation')} headers={[ui('Class'), 'TP', 'FP', 'FN', ui('Reference n'), ui('Predicted n'), ui('Precision'), ui('Recall'), 'F1']}>
          {metric.classes.map(c => <tr key={c.label}><th scope="row">{label(c.label)}</th><td>{c.tp}</td><td>{c.fp}</td><td>{c.fn}</td><td>{c.support}</td><td>{c.predicted}</td><td>{dec(c.precision)}</td><td>{dec(c.recall)}</td><td>{dec(c.f1)}</td></tr>)}
        </EvidenceTable>
        {/* Always-visible key: the column headers are standard abbreviations. */}
        <dl className="evidence-legend-grid" aria-label={ui('Column meanings')}>
          {([
            ['TP', ui('True positive — NewsAgg and the reference both chose this class.')],
            ['FP', ui('False positive — NewsAgg chose this class, the reference chose another.')],
            ['FN', ui('False negative — the reference chose this class, NewsAgg chose another.')],
            [ui('Reference n'), ui('Support — articles the reference put in this class (TP + FN).')],
            [ui('Predicted n'), ui('Articles NewsAgg put in this class (TP + FP).')],
            [ui('Precision'), ui('Of NewsAgg’s labels for this class, the share the reference agrees with: TP / (TP + FP).')],
            [ui('Recall'), ui('Of the reference’s articles in this class, the share NewsAgg also found: TP / (TP + FN).')],
            ['F1', ui('F1 score — harmonic mean of precision and recall: 2TP / (2TP + FP + FN). 1 is perfect, 0 is none.')],
          ] as const).map(([term, meaning]) => <div key={term}><dt>{term}</dt><dd>{meaning}</dd></div>)}
        </dl>
        <details className="evidence-details"><summary>{ui('How to calculate these numbers')}</summary>
          <p>{ui('TP = matching predictions for a class. FP = assigned to that class but the reference chose another. FN = reference chose that class but the system chose another.')}</p>
          <code>Precision = TP / (TP + FP) · Recall = TP / (TP + FN)</code>
          <code>F1 = 2TP / (2TP + FP + FN)</code>
          <code>Macro F1 = ({metric.classes.map(c => dec(c.f1)).join(' + ')}) / {metric.labels.length} = {dec(metric.macroF1)}</code>
          <p>{ui('Macro F1 is the mean of the class F1 scores, so a rare class matters as much as a common one. All 3 sentiment or 8 topic classes are included; a zero denominator is assigned 0. Calculations use full precision; displayed values are rounded.')}</p>
          <code>{ui('Agreement')} = {metric.matches}/{metric.n} = {pct(metric.agreement)}</code>
          <code>pₑ = Σ(rowᵢ × columnᵢ) / n² = {dec(metric.chance)}; κ = (pₒ − pₑ) / (1 − pₑ) = {dec(metric.kappa)}</code>
          <p>{ui('Cohen κ corrects observed agreement pₒ for chance agreement pₑ estimated from class frequencies. κ is undefined when pₑ = 1. Neither κ nor F1 establishes who authored a label.')}</p>
          <p><a href="https://scikit-learn.org/stable/modules/generated/sklearn.metrics.f1_score.html" target="_blank" rel="noreferrer">F1 / macro averaging</a> · <a href="https://scikit-learn.org/stable/modules/generated/sklearn.metrics.cohen_kappa_score.html" target="_blank" rel="noreferrer">Cohen κ</a> — {ui('definition references; calculations here use the project evaluator.')}</p>
        </details>
      </div>
      <details className="evidence-details"><summary>{ui('Breakdown by publisher and language')} · {name(reference)}</summary>
        <EvidenceTable caption={ui('Same frozen sample · source and language subsets')} headers={[ui('Subset'), ...scoreHeaders]}>
          {Object.entries(metric.bySource).map(([key, m]) => <tr key={key}><th scope="row">{label(key)}</th><Scores score={m} /></tr>)}
          {Object.entries(metric.byLanguage).map(([key, m]) => <tr key={key}><th scope="row">{label(key)}</th><Scores score={m} /></tr>)}
        </EvidenceTable><p>{ui('Language and publisher overlap: all Traditional Chinese articles come from Yahoo Taiwan. Differences cannot be attributed to language alone. Fixed-class macro F1 includes absent classes in each subset.')}</p>
      </details>
    </div>}

    {view === 'pairs' && <div className="evidence-body">
      <p>{ui('All 15 unique reference pairs: 6 human–human, 8 human–AI and 1 AI–AI. For F1 and the downloaded matrices, the left reference supplies the row labels and the right reference supplies the comparison labels.')}</p>
      <EvidenceTable caption={ui('Pairwise reference comparisons')} headers={[ui('Reference → comparison'), ...scoreHeaders]}>
        {data.pairs.map(p => <tr key={`${p.reference}-${p.comparison}`}><th scope="row">{name(p.reference)} → {name(p.comparison)}</th><Scores score={p.tasks[task]} /></tr>)}
      </EvidenceTable>
    </div>}
    {view === 'methods' && <ResearchMethods tx={tx} />}
    {view === 'tests' && <VerificationResults tx={tx} />}
    {view === 'references' && <ResearchReferences tx={tx} />}

    <details className="evidence-details mt-5"><summary>{ui('Study limitations & provenance')}</summary>
      <ul>
        <li>{ui('Four complete human submissions and two AI submissions scored the same 120 articles: 720 annotation records, not 720 unique articles. Human references are pseudonymized A–D; raw identities, rationales and publisher text are not included in the public download.')}</li>
        <li>{ui('The model predicted 6 positive, 29 neutral and 85 negative labels. Humans labelled 25–33 articles positive. This is a sample-specific negative skew, not evidence that the news is false or that the publisher is biased.')}</li>
        <li>{ui('The human guide defines sentiment as event direction, while the website describes linguistic tone. It also contains three sample-specific AI-labelled examples. Reading the guide, blind independence, full-text coverage and AI assistance are unverified; this is not a controlled independent benchmark.')}</li>
        <li>{ui('Astra used selected excerpts for 116 articles and complete supplied text for 4. The Opus model name is declared in the submitted file; model identity and reading coverage are not independently authenticated. Agreement cannot establish independence or detect AI assistance.')}</li>
        <li>{ui('Adjudication has not started in this snapshot. Human reviewers must resolve differing labels and document reasons before a final gold-reference evaluation. AI labels are auxiliary references and are not included in human consensus.')}</li>
      </ul>
      <p>{ui('Source snapshot SHA-256')}:</p><code className="break-all">{data.sourceSha256}</code>
      <p>{ui('All input hashes were verified and 114 metric groups were recomputed before public export. These checks validate arithmetic and input integrity, not the truth of the reference labels.')}</p>
    </details>
    <p className="mt-4 text-sm"><Link to="/methodology">{ui('Read the complete methodology')} →</Link></p>
  </section>;
}
