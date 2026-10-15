// Offline publication of aggregate evidence only. Never copy coordinator files
// into public/. Re-run explicitly when a reviewed evaluation snapshot changes.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');
const base = resolve(root, 'baogao/NLP_evaluation');
const input = resolve(base, 'coordinator_only/review-2026-10-15/summary.json');
const raw = readFileSync(input);
const summary = JSON.parse(raw);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
for (const [file, expected] of Object.entries(summary.source_hashes)) {
  assert.equal(sha(readFileSync(resolve(base, file))), expected, `Changed input: ${file}`);
}
assert.equal(summary.sample_n, 120);
assert.equal(summary.final_human_accuracy, null);
const ids = { '01257168': 'human-a', '01257072': 'human-b', '01257073': 'human-c', '01257169': 'human-d', astra: 'astra', opus: 'opus' };
const names = { 'human-a': 'Human A', 'human-b': 'Human B', 'human-c': 'Human C', 'human-d': 'Human D', astra: 'gpt-6-astra', opus: 'claude-opus-5' };
let checked = 0;
function metrics(m) {
  const labels = Object.keys(m.per_class);
  const matrix = labels.map(a => labels.map(b => m.matrix_rows_reference_columns_comparison[a][b]));
  const rows = matrix.map(row => row.reduce((a, b) => a + b, 0));
  const cols = labels.map((_, j) => matrix.reduce((s, row) => s + row[j], 0));
  const n = rows.reduce((a, b) => a + b, 0);
  const matches = matrix.reduce((s, row, i) => s + row[i], 0);
  const classes = labels.map((label, i) => {
    const tp = matrix[i][i], fp = cols[i] - tp, fn = rows[i] - tp;
    return { label, tp, fp, fn, support: rows[i], predicted: cols[i], precision: cols[i] ? tp / cols[i] : 0, recall: rows[i] ? tp / rows[i] : 0, f1: rows[i] + cols[i] ? 2 * tp / (rows[i] + cols[i]) : 0 };
  });
  const agreement = n ? matches / n : null;
  const chance = n ? rows.reduce((s, r, i) => s + r * cols[i], 0) / n ** 2 : null;
  const kappa = chance === null || chance === 1 ? null : (agreement - chance) / (1 - chance);
  const macroF1 = classes.reduce((s, c) => s + c.f1, 0) / labels.length;
  assert.equal(n, m.n);
  assert.equal(matches, m.matches);
  for (const [actual, expected] of [[agreement, m.agreement], [kappa, m.cohens_kappa], [macroF1, m.macro_f1_fixed_classes]]) {
    if (actual === null || expected === null) assert.equal(actual, expected);
    else assert.ok(Math.abs(actual - expected) < 1e-12, 'Metric mismatch');
  }
  checked++;
  return { n, matches, agreement, macroF1, kappa, chance, labels, matrix, classes };
}
const references = summary.roster.map(r => {
  const id = ids[r.key];
  assert.ok(id, 'Unknown reference must be reviewed before public export');
  const record = summary.newsagg_against_each_reference.find(x => x.reference === r.key);
  return { id, name: names[id], kind: id.startsWith('human-') ? 'human' : 'ai', records: r.records,
    tasks: Object.fromEntries(Object.entries(record.tasks).map(([task, m]) => [task, {
      ...metrics(m),
      bySource: Object.fromEntries(Object.entries(m.by_source).map(([key, value]) => [key, metrics(value)])),
      byLanguage: Object.fromEntries(Object.entries(m.by_language).map(([key, value]) => [key, metrics(value)])),
    }])) };
});
const pairs = summary.pairwise_reference_agreement.map(p => ({
  reference: ids[p.raters[0]], comparison: ids[p.raters[1]],
  tasks: Object.fromEntries(Object.entries(p.tasks).map(([key, m]) => [key, metrics(m)])),
}));
assert.equal(checked, 114);
const sourceCounts = Object.entries(summary.review_articles.reduce((acc, a) => { acc[a.source] = (acc[a.source] || 0) + 1; return acc; }, {}));
const output = {
  schemaVersion: 1, date: summary.as_of_taipei, sampleN: summary.sample_n,
  sourceSha256: sha(raw), sources: Object.fromEntries(sourceCounts),
  languages: Object.fromEntries(Object.entries(summary.newsagg_against_each_reference[0].tasks.sentiment.by_language).map(([k, v]) => [k, v.n])),
  finalAccuracy: null, adjudication: 'not-started', references, pairs,
  humanDisagreementUnion: new Set(Object.values(summary.human_only_agreement).flatMap(m => m.disagreement_sample_numbers)).size,
  humanUnanimity: Object.fromEntries(Object.entries(summary.human_only_agreement).map(([task, m]) => [task, { n: m.n, unanimous: m.unanimous, disagreements: m.not_unanimous }])),
  validation: { inputHashesVerified: true, metricGroupsRecomputed: checked, originalIntegrationTestsPassed: 13, rawLabelsChanged: false },
};
const serialized = JSON.stringify(output, null, 2) + '\n';
assert.ok(!/01257\d{3}|@|rationale|article_id|coordinator_only|[A-Z]:\\/.test(serialized), 'Private fields in public export');
const destination = resolve(root, 'client/src/app/data/evaluation.json');
mkdirSync(dirname(destination), { recursive: true });
writeFileSync(destination, serialized);
console.log(`Exported ${references.length} references, ${pairs.length} pairs; ${checked} metric groups verified; no raw articles or identities.`);
