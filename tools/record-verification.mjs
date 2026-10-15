// Runs existing offline suites and exports a public, name/status-only receipt.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '..');
const scratch = resolve(root, '.codex_tmp/insights-evidence');
mkdirSync(scratch, { recursive: true });
const destination = resolve(root, 'client/src/app/data/verification.json');
const python = process.env.NEWSAGG_EVAL_PYTHON;
assert.ok(python, 'Set NEWSAGG_EVAL_PYTHON to the available Python executable');
async function run(exe, args, cwd) {
  return await new Promise((done, reject) => {
    const proc = spawn(exe, args, { cwd, windowsHide: true, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
    let stdout = '', stderr = '';
    proc.stdout.on('data', b => { stdout += b; });
    proc.stderr.on('data', b => { stderr += b; });
    proc.on('error', reject);
    proc.on('close', code => done({ code, stdout, stderr }));
  });
}
async function vitest(id) {
  const output = resolve(scratch, `${id}.json`);
  const runResult = await run(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--reporter=json', `--outputFile=${output}`], resolve(root, id));
  assert.equal(runResult.code, 0, `${id} failed; inspect ${output}. ${runResult.stderr.slice(-1200)}`);
  const report = JSON.parse(readFileSync(output, 'utf8'));
  const cases = report.testResults.flatMap(s => s.assertionResults.map(c => ({ name: c.fullName, status: c.status === 'passed' ? 'passed' : ['pending', 'skipped', 'todo'].includes(c.status) ? 'skipped' : 'failed' })));
  return { id, cases, passed: cases.filter(c => c.status === 'passed').length, failed: cases.filter(c => c.status === 'failed').length, skipped: cases.filter(c => c.status === 'skipped').length };
}
async function receipt(id, exe, args, cwd) {
  const result = await run(exe, args, cwd);
  assert.equal(result.code, 0, `${id} failed: ${result.stdout.slice(-1800)} ${result.stderr.slice(-1000)}`);
  return { id, ...JSON.parse(result.stdout.trim()) };
}
// Bootstrap only for the first build; a full receipt is written only on success.
try { readFileSync(destination); } catch { writeFileSync(destination, JSON.stringify({ recordedAt: new Date().toISOString(), suites: [] })); }
const operations = readdirSync(resolve(root, 'server/scripts')).filter(f => f.endsWith('.test.mjs')).map(f => `server/scripts/${f}`);
operations.push('deploy/stable-origin/worker.test.mjs');
const results = await Promise.allSettled([
  vitest('client'), vitest('server'),
  receipt('operations', process.execPath, ['--test', '--test-reporter=./tools/verification-reporter.mjs', ...operations], root),
  receipt('scraper', 'docker', ['run', '--rm', '--network', 'none', '--cpus', '1', '--memory', '1g', '--entrypoint', 'python', '-e', 'PYTHONDONTWRITEBYTECODE=1', '-v', `${root}/scraper:/audit:ro`, '-v', `${root}/tools/verification-unittest.py:/runner.py:ro`, '-w', '/audit', 'website-scraper:latest', '/runner.py', 'tests', 'test_*.py'], root),
  receipt('evaluation', python, [resolve(root, 'tools/verification-unittest.py'), '.', 'test_integrate_reviews.py'], resolve(root, 'baogao/NLP_evaluation')),
]);
for (const [i, result] of results.entries()) console.log(result.status === 'fulfilled' ? `${result.value.id}: ${result.value.passed} passed, ${result.value.failed} failed, ${result.value.skipped} skipped` : `Suite ${i} failed: ${result.reason}`);
if (results.some(r => r.status === 'rejected')) process.exit(1);
const suites = results.map(r => r.value);
assert.ok(suites.every(s => s.passed > 0 && s.failed === 0));
writeFileSync(destination, JSON.stringify({ recordedAt: new Date().toISOString(), scope: 'offline-regression', suites }, null, 2) + '\n');
console.log('Published offline verification receipt. No live scraping, email or inference requested.');
