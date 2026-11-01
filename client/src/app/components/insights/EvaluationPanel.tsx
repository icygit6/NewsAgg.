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
  const { language, isDark } = useApp();
  const zh = language === 'zhTW' || language === 'zhCN';
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
  const scoreHeaders = [tx('Matches / n', '相同 / 樣本數'), tx('Agreement', '一致率'), 'Macro F1', 'Cohen κ'];
  const tabs = [
    ['results', tx('Evaluation', '評估結果')], ['pairs', tx('Human & AI comparisons', '人工與 AI 比較')],
    ['methods', tx('Models & calculations', '模型與計算')], ['tests', tx('Verification', '測試與驗證')],
    ['references', tx('Glossary & references', '名詞與參考文獻')],
  ];

  return <section id="research" className={`evidence mt-8 ${isDark ? 'evidence-dark' : ''}`} aria-labelledby="research-title">
    <div className="evidence-heading">
      <div><p className="evidence-eyebrow"><FlaskConical size={16} aria-hidden /> {tx('Research notebook', '研究紀錄')}</p>
        <h2 id="research-title">{tx('Behind the analysis', '分析背後的數據')}</h2>
        <p>{tx('A frozen evaluation sample, with traceable calculations and test evidence.', '以固定樣本呈現評估、可追溯的計算及測試證據。')}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <a className="evidence-download" href="/research-foundations.html"><BookOpen size={16} aria-hidden />{tx('Research foundations', '研究依據')}</a>
        <a className="evidence-download" href={dataUrl} download="NewsAgg-evaluation-2026-10-15.json"><ArrowDownToLine size={16} aria-hidden />{tx('Download aggregate JSON', '下載彙總 JSON')}</a>
      </div>
    </div>
    <div className="evidence-kpis">
      {[[String(data.sampleN), tx('unique articles', '篇獨立文章')], ['4 + 2', tx('human + AI references', '人工 + AI 參考')], [String(data.humanDisagreementUnion), tx('articles needing adjudication', '篇待人工裁決')], [data.date, tx('evaluation snapshot · Taipei', '評估快照 · 臺北時間')]].map(([value, caption]) => <div key={caption}><strong>{value}</strong><span>{caption}</span></div>)}
    </div>
    <p className="evidence-notice">{tx('Interim reference agreement, not final accuracy. No adjudicated gold labels exist yet. This 120-article snapshot is separate from the live feed and does not change with its category filter.', '目前是與參考標註的一致程度，並非最終準確率；尚未建立經裁決的標準答案。此 120 篇固定樣本與即時新聞列表分開，不隨列表分類篩選變動。')}</p>
    <div className="evidence-tabs" aria-label={tx('Research sections', '研究分區')}>
      {tabs.map(([id, title]) => <button type="button" key={id} aria-pressed={view === id} onClick={() => setView(id)}>{title}</button>)}
    </div>

    {(view === 'results' || view === 'pairs') && <div className="evidence-controls">
      {/* Visible choices instead of native selects: two tasks as a segmented
          switch, six references as grouped chips. */}
      <div className="evidence-control">
        <span id="evidence-task-label">{tx('Task', '評估任務')}</span>
        <div className="evidence-segment" role="group" aria-labelledby="evidence-task-label">
          {([['sentiment', tx('Sentiment · 3 classes', '情緒 · 3 類')], ['topic', tx('Topic · 8 classes', '主題 · 8 類')]] as const).map(([value, title]) =>
            <button type="button" key={value} aria-pressed={task === value} onClick={() => setTask(value)}>{title}</button>)}
        </div>
      </div>
      {view === 'results' && <div className="evidence-control">
        <span id="evidence-reference-label">{tx('Reference for details', '詳細結果的參考標註')}</span>
        <div className="evidence-chips" role="group" aria-labelledby="evidence-reference-label">
          {(['human', 'ai'] as const).map(kind => <div key={kind} className="evidence-chip-group">
            <small>{kind === 'human' ? tx('Human', '人工') : tx('AI reference', 'AI 參考')}</small>
            {data.references.filter(r => (r.kind === 'human') === (kind === 'human')).map(r =>
              <button type="button" key={r.id} aria-pressed={reference === r.id} onClick={() => setReference(r.id)}>{name(r.id)}</button>)}
          </div>)}
        </div>
      </div>}
    </div>}

    {view === 'results' && <div className="evidence-body">
      <div className="evidence-grid">
        <div className="evidence-card"><h3>{tx('NewsAgg vs each reference', 'NewsAgg 與各參考標註')}</h3>
          <p>{tx('Macro F1 · equal weight per class · scale 0–1', 'Macro F1 · 各類等權重 · 範圍 0–1')}</p>
          <div className="evidence-bars">{data.references.map(r => <div className="evidence-bar-row" key={r.id}>
            <span>{name(r.id)}</span><div className="evidence-bar-track"><div className={r.kind === 'human' ? 'evidence-bar-human' : 'evidence-bar-ai'} style={{ width: `${r.tasks[task].macroF1 * 100}%` }} /></div><b>{dec(r.tasks[task].macroF1)}</b>
          </div>)}</div>
          <p className="evidence-legend">{tx('Blue: human reference · violet: AI reference. Exact values below.', '藍色：人工參考 · 紫色：AI 參考。精確數值如下。')}</p>
        </div>
        <div className="evidence-card"><h3>{tx('Sample & disagreement', '樣本與分歧')}</h3>
          <p>{tx('30 articles per publisher; 90 English and 30 Traditional Chinese. These are published articles, so rejected scraping candidates are not evaluated.', '每家媒體 30 篇；英文 90 篇、繁體中文 30 篇。樣本取自已發布文章，未評估擷取時被拒絕的候選文章。')}</p>
          <div className="evidence-unanimity"><strong>{unanimous.unanimous}/120</strong><span>{tx('four-human unanimous labels', '四位人工標註完全一致')}</span></div>
          <div className="evidence-stacked" aria-label={`${unanimous.unanimous}/120`}><div style={{ width: `${unanimous.unanimous / 1.2}%` }} /></div>
          <p>{tx(`${unanimous.disagreements} disagreements for this task. Across both tasks, 93 unique articles require review; do not add the two task counts together.`, `此任務有 ${unanimous.disagreements} 篇分歧。兩項任務合計 93 篇不同文章待討論，不應直接相加兩項分歧數。`)}</p>
        </div>
      </div>
      <EvidenceTable caption={tx('System-to-reference scores', '系統與參考標註的分數')} headers={[tx('Reference', '參考標註'), ...scoreHeaders]}>
        {data.references.map(r => <tr key={r.id}><th scope="row">{name(r.id)} <small>{r.kind === 'human' ? tx('human', '人工') : tx('AI reference', 'AI 參考')}</small></th><Scores score={r.tasks[task]} /></tr>)}
      </EvidenceTable>
      <div className="evidence-card">
        <h3>{tx('Confusion matrix', '混淆矩陣')} · {name(reference)}</h3>
        <p>{tx('Rows = reference labels. Columns = NewsAgg predictions. Diagonal cells are matches; every cell is an article count.', '列為參考標註，欄為 NewsAgg 預測。對角線表示一致，每格皆為文章篇數。')}</p>
        <EvidenceTable caption={`${name(reference)} → NewsAgg`} headers={[tx('Reference ↓ / NewsAgg →', '參考標註 ↓ / NewsAgg →'), ...metric.labels.map(label)]}>
          {metric.matrix.map((row, i) => <tr key={metric.labels[i]}><th scope="row">{label(metric.labels[i])}</th>{row.map((count, j) => <td key={j} className={i === j ? 'evidence-diagonal' : ''}>{count}</td>)}</tr>)}
        </EvidenceTable>
        <EvidenceTable caption={tx('Per-class calculation', '各類計算明細')} headers={[tx('Class', '類別'), 'TP', 'FP', 'FN', tx('Reference n', '參考樣本數'), tx('Predicted n', '預測篇數'), tx('Precision', '精確率'), tx('Recall', '召回率'), 'F1']}>
          {metric.classes.map(c => <tr key={c.label}><th scope="row">{label(c.label)}</th><td>{c.tp}</td><td>{c.fp}</td><td>{c.fn}</td><td>{c.support}</td><td>{c.predicted}</td><td>{dec(c.precision)}</td><td>{dec(c.recall)}</td><td>{dec(c.f1)}</td></tr>)}
        </EvidenceTable>
        {/* Always-visible key: the column headers are standard abbreviations. */}
        <dl className="evidence-legend-grid" aria-label={tx('Column meanings', '欄位說明')}>
          {([
            ['TP', tx('True positive — NewsAgg and the reference both chose this class.', '真陽性（True Positive）：NewsAgg 與參考標註都選此類。')],
            ['FP', tx('False positive — NewsAgg chose this class, the reference chose another.', '偽陽性（False Positive）：NewsAgg 選此類，參考標註選了其他類。')],
            ['FN', tx('False negative — the reference chose this class, NewsAgg chose another.', '偽陰性（False Negative）：參考標註選此類，NewsAgg 選了其他類。')],
            [tx('Reference n', '參考樣本數'), tx('Support — articles the reference put in this class (TP + FN).', '支持數（support）：參考標註歸入此類的篇數（TP + FN）。')],
            [tx('Predicted n', '預測篇數'), tx('Articles NewsAgg put in this class (TP + FP).', 'NewsAgg 歸入此類的篇數（TP + FP）。')],
            [tx('Precision', '精確率'), tx('Of NewsAgg’s labels for this class, the share the reference agrees with: TP / (TP + FP).', 'NewsAgg 判為此類者中，與參考一致的比例：TP / (TP + FP)。')],
            [tx('Recall', '召回率'), tx('Of the reference’s articles in this class, the share NewsAgg also found: TP / (TP + FN).', '參考標註屬於此類者中，NewsAgg 也判對的比例：TP / (TP + FN)。')],
            ['F1', tx('F1 score — harmonic mean of precision and recall: 2TP / (2TP + FP + FN). 1 is perfect, 0 is none.', 'F1 分數：精確率與召回率的調和平均，2TP / (2TP + FP + FN)；1 為完全一致，0 為完全不符。')],
          ] as const).map(([term, meaning]) => <div key={term}><dt>{term}</dt><dd>{meaning}</dd></div>)}
        </dl>
        <details className="evidence-details"><summary>{tx('How to calculate these numbers', '這些數值如何計算')}</summary>
          <p>{tx('TP = matching predictions for a class. FP = assigned to that class but the reference chose another. FN = reference chose that class but the system chose another.', 'TP＝該類預測與參考一致；FP＝預測為該類但參考為其他類；FN＝參考為該類但預測為其他類。')}</p>
          <code>Precision = TP / (TP + FP) · Recall = TP / (TP + FN)</code>
          <code>F1 = 2TP / (2TP + FP + FN)</code>
          <code>Macro F1 = ({metric.classes.map(c => dec(c.f1)).join(' + ')}) / {metric.labels.length} = {dec(metric.macroF1)}</code>
          <p>{tx('Macro F1 is the mean of the class F1 scores, so a rare class matters as much as a common one. All 3 sentiment or 8 topic classes are included; a zero denominator is assigned 0. Calculations use full precision; displayed values are rounded.', 'Macro F1 是各類 F1 的平均值，少數類與多數類同等重要。情緒固定計入 3 類、主題固定 8 類；分母為零時記為 0。計算使用完整精度，顯示時才四捨五入。')}</p>
          <code>{tx('Agreement', '一致率')} = {metric.matches}/{metric.n} = {pct(metric.agreement)}</code>
          <code>pₑ = Σ(rowᵢ × columnᵢ) / n² = {dec(metric.chance)}; κ = (pₒ − pₑ) / (1 − pₑ) = {dec(metric.kappa)}</code>
          <p>{tx('Cohen κ corrects observed agreement pₒ for chance agreement pₑ estimated from class frequencies. κ is undefined when pₑ = 1. Neither κ nor F1 establishes who authored a label.', 'Cohen κ 以類別頻率估計偶然一致率 pₑ，校正觀察一致率 pₒ；pₑ＝1 時無法定義。κ 與 F1 均不能證明標註由誰完成。')}</p>
          <p><a href="https://scikit-learn.org/stable/modules/generated/sklearn.metrics.f1_score.html" target="_blank" rel="noreferrer">F1 / macro averaging</a> · <a href="https://scikit-learn.org/stable/modules/generated/sklearn.metrics.cohen_kappa_score.html" target="_blank" rel="noreferrer">Cohen κ</a> — {tx('definition references; calculations here use the project evaluator.', '公式定義參考；本頁使用專案評估程式計算。')}</p>
        </details>
      </div>
      <details className="evidence-details"><summary>{tx('Breakdown by publisher and language', '依媒體與語言細分')} · {name(reference)}</summary>
        <EvidenceTable caption={tx('Same frozen sample · source and language subsets', '同一固定樣本 · 來源與語言子集')} headers={[tx('Subset', '子集'), ...scoreHeaders]}>
          {Object.entries(metric.bySource).map(([key, m]) => <tr key={key}><th scope="row">{label(key)}</th><Scores score={m} /></tr>)}
          {Object.entries(metric.byLanguage).map(([key, m]) => <tr key={key}><th scope="row">{label(key)}</th><Scores score={m} /></tr>)}
        </EvidenceTable><p>{tx('Language and publisher overlap: all Traditional Chinese articles come from Yahoo Taiwan. Differences cannot be attributed to language alone. Fixed-class macro F1 includes absent classes in each subset.', '語言與媒體相互重疊：所有繁體中文樣本都來自 Yahoo 臺灣，差異不能單獨歸因於語言。子集的 Macro F1 仍計入固定類別，包括未出現的類別。')}</p>
      </details>
    </div>}

    {view === 'pairs' && <div className="evidence-body">
      <p>{tx('All 15 unique reference pairs: 6 human–human, 8 human–AI and 1 AI–AI. For F1 and the downloaded matrices, the left reference supplies the row labels and the right reference supplies the comparison labels.', '共 15 組：人工對人工 6 組、人工對 AI 8 組、AI 對 AI 1 組。F1 與下載矩陣以左側標註為參考列、右側標註為比較欄。')}</p>
      <EvidenceTable caption={tx('Pairwise reference comparisons', '參考標註兩兩比較')} headers={[tx('Reference → comparison', '參考 → 比較'), ...scoreHeaders]}>
        {data.pairs.map(p => <tr key={`${p.reference}-${p.comparison}`}><th scope="row">{name(p.reference)} → {name(p.comparison)}</th><Scores score={p.tasks[task]} /></tr>)}
      </EvidenceTable>
    </div>}
    {view === 'methods' && <ResearchMethods tx={tx} />}
    {view === 'tests' && <VerificationResults tx={tx} />}
    {view === 'references' && <ResearchReferences tx={tx} />}

    <details className="evidence-details mt-5"><summary>{tx('Study limitations & provenance', '研究限制與資料來源')}</summary>
      <ul>
        <li>{tx('Four complete human submissions and two AI submissions scored the same 120 articles: 720 annotation records, not 720 unique articles. Human references are pseudonymized A–D; raw identities, rationales and publisher text are not included in the public download.', '四份完整人工標註與兩份 AI 標註評估同一批 120 篇文章，共 720 筆標註紀錄，並非 720 篇文章。人工標註以 A–D 代稱，公開下載不含身分、理由或媒體原文。')}</li>
        <li>{tx('The model predicted 6 positive, 29 neutral and 85 negative labels. Humans labelled 25–33 articles positive. This is a sample-specific negative skew, not evidence that the news is false or that the publisher is biased.', '模型預測為正面 6 篇、中性 29 篇、負面 85 篇；人工正面標註為 25–33 篇。這是此樣本的負向分布偏差，不表示新聞不實或媒體有偏見。')}</li>
        <li>{tx('The human guide defines sentiment as event direction, while the website describes linguistic tone. It also contains three sample-specific AI-labelled examples. Reading the guide, blind independence, full-text coverage and AI assistance are unverified; this is not a controlled independent benchmark.', '人工指南將情緒定義為事件方向，網站則描述語句語氣；指南還包含三個特定樣本的 AI 標註範例。是否閱讀指南、盲測獨立性、全文閱讀及 AI 協助均未確認，因此不是受控的獨立基準測試。')}</li>
        <li>{tx('Astra used selected excerpts for 116 articles and complete supplied text for 4. The Opus model name is declared in the submitted file; model identity and reading coverage are not independently authenticated. Agreement cannot establish independence or detect AI assistance.', 'Astra 以節錄評估 116 篇、完整提供文字評估 4 篇；Opus 模型名稱取自提交檔，未獨立驗證身分與閱讀範圍。一致程度無法判定獨立性或是否有 AI 協助。')}</li>
        <li>{tx('Adjudication has not started in this snapshot. Human reviewers must resolve differing labels and document reasons before a final gold-reference evaluation. AI labels are auxiliary references and are not included in human consensus.', '此快照尚未開始裁決；人工須討論分歧並記錄理由，之後才能建立最終標準答案。AI 標註僅為輔助參考，不納入人工共識。')}</li>
      </ul>
      <p>{tx('Source snapshot SHA-256', '來源快照 SHA-256')}:</p><code className="break-all">{data.sourceSha256}</code>
      <p>{tx('All input hashes were verified and 114 metric groups were recomputed before public export. These checks validate arithmetic and input integrity, not the truth of the reference labels.', '公開匯出前已驗證所有輸入雜湊並重新計算 114 組指標。這些檢查驗證算術及輸入完整性，不能證明參考標註正確。')}</p>
    </details>
    <p className="mt-4 text-sm"><Link to="/methodology">{tx('Read the complete methodology', '閱讀完整方法說明')} →</Link></p>
  </section>;
}
