import receipt from '../../data/verification.json';
import testsUrl from '../../data/verification.json?url';
import { EvidenceTable, type EvidenceText } from './EvaluationPanel';
const tests = receipt as { recordedAt: string; suites: Array<{ id: string; passed: number; failed: number; skipped: number; cases: Array<{ name: string; status: string }> }> };

const coverage: Record<string, [string, string]> = {
  client: ['Browser-facing behavior: original/translated news, authentication, navigation, article rendering and evidence interactions.', '前端行為：原文與譯文、驗證、導覽、文章呈現與評估介面互動。'],
  server: ['API behavior with mocked dependencies: authentication, sessions, account controls, reports, chat citations, translation cache, markets and article routes.', '以模擬依賴驗證 API：驗證、工作階段、帳號控制、問題回報、問答引用、翻譯快取、市場行情與文章路由。'],
  operations: ['Offline daily policy, ingestion deadlines, edition handling, recipient checks, email orchestration and origin recovery.', '離線驗證每日政策、擷取期限、版本處理、收件人檢查、郵件流程與來源復原。'],
  scraper: ['Offline parser, discovery, categories, publication gates, quality filters, readability, toxicity handling, capacity and run reports.', '離線驗證解析、發現、分類、發布門檻、品質篩選、易讀度、毒性處理、容量與執行報告。'],
  evaluation: ['Annotation integrity, missing data, identities, label classes and metric arithmetic. Raw inputs are preserved.', '標註完整性、缺值、身分、類別值與指標算術；保留原始輸入。'],
};
export function VerificationResults({ tx }: { tx: EvidenceText }) {
  return <div className="evidence-body">
    <p>{tx('Recorded software checks, not live uptime or model accuracy. Tests use fixtures and mocks; no live scrape, paid inference or database load test is needed to display these results.', '以下是已記錄的軟體檢查，並非即時可用率或模型準確率。測試使用固定資料與模擬依賴；顯示結果不需即時擷取、付費推論或資料庫負載測試。')}</p>
    <p>{tx('Run time (Taipei)', '執行時間（臺北）')}: {new Date(tests.recordedAt).toLocaleString('en-GB', { timeZone: 'Asia/Taipei', hour12: false })}</p>
    <EvidenceTable caption={tx('Verification ledger', '驗證紀錄')} headers={[tx('Suite', '測試組'), tx('Passed', '通過'), tx('Failed', '失敗'), tx('Skipped', '略過')]}>
      {tests.suites.map(s => <tr key={s.id}><th scope="row">{s.id}</th><td>{s.passed}</td><td>{s.failed}</td><td>{s.skipped}</td></tr>)}
    </EvidenceTable>
    {tests.suites.map(s => <details className="evidence-details" key={s.id}><summary>{s.id} · {s.passed}/{s.passed + s.failed + s.skipped} {tx('passed', '通過')}</summary>
      <p>{tx(...coverage[s.id])}</p>
      <p>{tx('Original test identifiers are retained below for reproducibility.', '以下保留原始測試識別名稱以便重現。')}</p>
      <ul>{s.cases.map((c, i) => <li key={i}><span>{c.status === 'passed' ? '✓' : c.status === 'skipped' ? '—' : '✕'} </span>{c.name}</li>)}</ul>
    </details>)}
    <div className="evidence-card"><h3>{tx('What has not been measured', '尚未量測的項目')}</h3><p>{tx('No adjudicated final accuracy; no independent translation-quality, summary-quality, NER or toxicity benchmark; no production load/availability certification; no measured Neon compute saving from this test run. Passing regression tests establishes the tested behavior only.', '尚無經裁決的最終準確率、獨立翻譯品質、摘要品質、實體辨識或毒性基準；未進行正式環境負載／可用率認證，本次測試也未量測 Neon 算力節省。迴歸測試通過僅支持其涵蓋的行為。')}</p></div>
    <a className="evidence-download" href={testsUrl} download="NewsAgg-verification-2026-10-15.json">{tx('Download test results JSON', '下載測試結果 JSON')}</a>
  </div>;
}
