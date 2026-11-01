#!/usr/bin/env node
// Rebuild the live Docker site when its source changed since the last
// successful rebuild. Run by the Claude Code Stop hook, and safe to run by hand:
//   node ops/rebuild-live.mjs          rebuild what changed
//   node ops/rebuild-live.mjs --force  rebuild everything
//   node ops/rebuild-live.mjs --check  only report what is out of date
// Never touches volumes: the database (pgdata) is left alone.
//
// The Stop hook runs --check. Several sessions share this working tree, so an
// automatic rebuild at the end of one session's turn would also publish the
// others' unfinished edits; deploying stays a deliberate step.
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stateFile = join(root, 'logs', 'rebuild-live', 'state.json');
const lockFile = join(root, 'logs', 'rebuild-live', 'lock');
const force = process.argv.includes('--force');
const checkOnly = process.argv.includes('--check');

// Each target lists the paths whose content decides whether it is stale and
// the compose command that brings the live container up to date.
const targets = [
  { name: 'server', paths: ['server'], args: ['up', '-d', '--build', '--no-deps', 'server'] },
  { name: 'client', paths: ['client'], args: ['up', '-d', '--build', '--no-deps', 'client'] },
  {
    name: 'local-ai',
    paths: ['scraper/local_ai.py', 'scraper/Dockerfile.ai'],
    args: ['up', '-d', '--build', '--no-deps', 'local-ai'],
  },
  // The scraper only runs at 17:00, so its image is rebuilt, not started.
  { name: 'scraper', paths: ['scraper'], args: ['--profile', 'scraper', 'build', 'scraper'] },
  { name: 'compose', paths: ['docker-compose.yml', 'deploy/postgres'], args: ['up', '-d'] },
];

function readStdin() {
  if (process.stdin.isTTY) return {};
  try {
    return JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
}

function fingerprint(paths) {
  const listed = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z', '--', ...paths], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const hash = createHash('sha1');
  for (const file of [...new Set(listed.split('\0').filter(Boolean))].sort()) {
    const full = join(root, file);
    if (!existsSync(full)) continue;
    hash.update(file).update('\0').update(readFileSync(full)).update('\0');
  }
  return hash.digest('hex');
}

function compose(args) {
  const run = () => spawnSync('docker', ['compose', ...args], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  let result = run();
  // Docker reports this when another build touched the same image meanwhile;
  // a second attempt on a quiet daemon succeeds.
  if (result.status !== 0 && /consistency error|data changed during operation/i.test(result.stderr ?? '')) {
    result = run();
  }
  return { ok: result.status === 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() };
}

function lockHolderAlive() {
  try {
    process.kill(Number(readFileSync(lockFile, 'utf8')), 0);
    return true;
  } catch {
    return false;
  }
}

// One rebuild at a time: two compose builds of the same image collide.
async function acquireLock() {
  mkdirSync(dirname(lockFile), { recursive: true });
  for (;;) {
    try {
      writeFileSync(lockFile, String(process.pid), { flag: 'wx' });
      process.on('exit', () => rmSync(lockFile, { force: true }));
      return;
    } catch {
      if (!lockHolderAlive()) rmSync(lockFile, { force: true });
      else await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

async function healthy(url) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 3000));
  }
  return false;
}

function tail(text, lines = 25) {
  return text.split(/\r?\n/).slice(-lines).join('\n');
}

const input = readStdin();
if (checkOnly) {
  const known = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : {};
  const behind = targets.filter((t) => known[t.name] !== fingerprint(t.paths)).map((t) => t.name);
  if (behind.length) {
    console.log(JSON.stringify({ systemMessage: `Live site is behind the working tree (${behind.join(', ')}). Nothing was deployed; run node ops/rebuild-live.mjs when the changes are ready.` }));
  }
  process.exit(0);
}
await acquireLock();
const state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : {};
const saveState = () => {
  mkdirSync(dirname(stateFile), { recursive: true });
  writeFileSync(stateFile, `${JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2)}\n`);
};
const stale = targets
  .map((t) => ({ ...t, print: fingerprint(t.paths) }))
  .filter((t) => force || state[t.name] !== t.print);

if (stale.length === 0) process.exit(0);

function fail(message) {
  // Exit 2 hands the message back to Claude so the turn continues and the
  // build gets fixed; on a retry that also fails, report and let the turn end.
  if (input.stop_hook_active) {
    console.log(JSON.stringify({ systemMessage: `Live rebuild still failing: ${message.split('\n')[0]}` }));
    process.exit(0);
  }
  console.error(message);
  process.exit(2);
}

if (!compose(['version']).ok || !compose(['ps', '-q']).ok) {
  fail('Live site not rebuilt: Docker is not running. Start Docker Desktop, then run node ops/rebuild-live.mjs.');
}

const done = [];
for (const target of stale) {
  const { ok, output } = compose(target.args);
  if (!ok) fail(`Live rebuild of ${target.name} failed:\n${tail(output)}`);
  state[target.name] = target.print;
  saveState();
  done.push(target.name);
}

const checks = [];
if (done.some((n) => ['server', 'compose'].includes(n))) checks.push(['API', 'http://127.0.0.1:3000/health']);
if (done.some((n) => ['client', 'compose'].includes(n))) checks.push(['website', 'http://127.0.0.1:8080/']);
for (const [label, url] of checks) {
  if (!(await healthy(url))) fail(`Rebuilt ${done.join(', ')}, but the ${label} at ${url} is not answering.`);
}

console.log(JSON.stringify({ systemMessage: `Live site rebuilt: ${done.join(', ')}` }));
