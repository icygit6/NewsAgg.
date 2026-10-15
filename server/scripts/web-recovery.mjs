import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile, spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {acquireLock, atomicJson, readJson} from './daily-runtime.mjs';

const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const directory = path.join(root, 'logs/web-recovery');
const cooldownMs = 10 * 60_000;
const quickOrigin = /^https:\/\/[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com$/;

// Pure decision function: outage retries cannot trigger ingestion or mail.
export function recoveryDecision(s) {
  if (s.publicHealthy) return 'healthy';
  if (!s.online) return 'offline';
  if (!s.dockerReady) return 'docker-unavailable';
  if (!s.servicesRunning) return 'services-stopped';
  if (!s.localHealthy) return 'local-unhealthy';
  if (s.tunnelStarting) return 'tunnel-starting';
  if (s.failures < 2) return 'confirming-failure';
  if (s.sinceAttemptMs < cooldownMs) return 'cooldown';
  if (s.tunnelReady && s.originKnown) {
    return s.originHealthy ? 'update-origin' : 'origin-unreachable';
  }
  return 'restart-tunnel';
}

export function latestOrigin(logs) {
  return logs.match(/https:\/\/[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com\b/g)?.at(-1) ?? null;
}

export function stableOrigin(env, dotenv) {
  const value = env || dotenv.match(/^NEWSAGG_STABLE_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, '');
  if (!value) throw new Error('missing-stable-url');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('invalid-stable-url');
  }
  return url.origin;
}

async function command(program, args, timeout = 15_000) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, {cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
    let stdout = '', stderr = '', bytes = 0, aborted = false;
    const stop = () => {
      if (aborted) return;
      aborted = true;
      // Kill only this invocation's process tree while its parent still exists,
      // so a timed-out PowerShell cannot leave a deployment running unlocked.
      if (process.platform === 'win32' && child.pid) {
        exec('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {windowsHide: true, timeout: 5000}).catch(() => child.kill());
      } else child.kill('SIGKILL');
    };
    const timer = setTimeout(stop, timeout);
    const collect = (target, chunk) => {
      bytes += chunk.length;
      if (bytes > 4 * 1024 * 1024) { stop(); return; }
      if (target === 'stdout') stdout += chunk; else stderr += chunk;
    };
    child.stdout.on('data', chunk => collect('stdout', chunk));
    child.stderr.on('data', chunk => collect('stderr', chunk));
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => {
      clearTimeout(timer);
      if (aborted || code !== 0) reject(new Error('command-failed-or-timed-out'));
      else resolve(program === 'docker' && args[0] === 'logs' ? stdout + stderr : stdout);
    });
  });
}
async function healthy(url) {
  try {
    const response = await fetch(url, {signal: AbortSignal.timeout(8000), cache: 'no-store'});
    const body = await response.json();
    // Liveness only: this runs every 2 minutes and must not keep Neon awake.
    return response.ok && body.ok === true;
  } catch { return false; }
}
async function online() {
  try {
    const response = await fetch('https://www.cloudflare.com/cdn-cgi/trace', {signal: AbortSignal.timeout(8000)});
    return response.ok && (await response.text()).includes('ip=');
  } catch { return false; }
}
async function containers() {
  const ids = (await command('docker', ['compose', 'ps', '-a', '-q', 'server', 'client', 'tunnel'])).trim().split(/\s+/).filter(Boolean);
  if (!ids.length) return {};
  const items = JSON.parse(await command('docker', ['inspect', ...ids]));
  return Object.fromEntries(items.map(item => [item.Config.Labels['com.docker.compose.service'], item]));
}
async function discoverOrigin(tunnel, state) {
  const generation = `${tunnel.Id}:${tunnel.State.StartedAt}`;
  if (state.generation === generation && quickOrigin.test(state.origin || '')) return state.origin;
  // Only this process generation's logs can supply its origin. An earlier
  // Quick Tunnel URL must never be redeployed after a restart.
  const logs = await command('docker', ['logs', '--since', tunnel.State.StartedAt, '--tail', '5000', tunnel.Id]);
  const origin = latestOrigin(logs);
  state.generation = generation;
  state.origin = origin;
  return origin;
}
function record(state, status) {
  state.status = status;
  state.checkedAt = new Date().toISOString();
  atomicJson(path.join(directory, 'state.json'), state);
  const log = path.join(directory, 'recovery.log');
  if (fs.existsSync(log) && fs.statSync(log).size > 512 * 1024) fs.renameSync(log, `${log}.previous`);
  fs.appendFileSync(log, `${state.checkedAt} ${status}\n`);
  console.log(status);
}

export async function recover() {
  const release = acquireLock(path.join(directory, 'recovery.lock'));
  let state = {};
  try {
    state = readJson(path.join(directory, 'state.json'), {}) || {};
    const stable = stableOrigin(process.env.NEWSAGG_STABLE_URL, fs.readFileSync(path.join(root, '.env'), 'utf8'));
    const publicHealthy = await healthy(`${stable}/health`);
    if (publicHealthy) {
      state.failures = 0;
      // Cache the current temporary URL before verbose retry logs roll it out.
      if (!state.origin) {
        try { const current = await containers(); if (current.tunnel) await discoverOrigin(current.tunnel, state); } catch { /* public health is authoritative */ }
      }
      record(state, 'healthy');
      return;
    }
    const isOnline = await online();
    if (!isOnline) { state.failures = 0; record(state, 'offline'); return; }
    let current;
    try { current = await containers(); }
    catch { state.failures = 0; record(state, 'docker-unavailable'); return; }
    const running = ['server', 'client', 'tunnel'].every(name => current[name]?.State.Running === true);
    const localHealthy = running && await healthy('http://127.0.0.1:8080/health');
    const tunnel = current.tunnel;
    let origin = null;
    if (running) origin = await discoverOrigin(tunnel, state);
    state.failures = running && localHealthy ? Math.min((state.failures || 0) + 1, 100) : 0;
    const tunnelReady = tunnel?.State.Health?.Status === 'healthy';
    const originHealthy = tunnelReady && origin ? await healthy(`${origin}/health`) : false;
    const decision = recoveryDecision({publicHealthy, online: isOnline, dockerReady: true,
      servicesRunning: running, localHealthy, tunnelStarting: tunnel?.State.Health?.Status === 'starting',
      tunnelReady, originKnown: Boolean(origin), originHealthy, failures: state.failures,
      sinceAttemptMs: state.lastAttemptAt ? Date.now() - Date.parse(state.lastAttemptAt) : Infinity});
    if (!['restart-tunnel', 'update-origin'].includes(decision)) { record(state, decision); return; }
    state.lastAttemptAt = new Date().toISOString();
    record(state, decision);
    if (decision === 'restart-tunnel') {
      await command('docker', ['compose', 'restart', 'tunnel'], 30_000);
      state.origin = null;
      for (let attempt = 0; attempt < 12; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 2500));
        current = await containers();
        if (!current.tunnel?.State.Running) break;
        origin = await discoverOrigin(current.tunnel, state);
        if (origin && await healthy(`${origin}/health`)) break;
      }
    }
    if (!quickOrigin.test(origin || '') || !await healthy(`${origin}/health`)) {
      record(state, 'origin-not-ready'); return;
    }
    // Use the existing narrowly scoped Worker update. Never run daily-run,
    // START-NEWSAGG, a build, an ingest command, or any email entrypoint here.
    try {
      await command('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
        '-File', path.join(root, 'UPDATE-STABLE-ORIGIN.ps1'), '-TunnelUrl', origin], 240_000);
    } catch { record(state, 'origin-update-failed-check-cloudflare-auth'); process.exitCode = 1; return; }
    if (await healthy(`${stable}/health`)) { state.failures = 0; record(state, 'recovered'); }
    else { record(state, 'public-health-failed'); process.exitCode = 1; }
  } catch {
    record(state, 'recovery-error-check-local-config');
    process.exitCode = 1;
  } finally { release(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  recover().catch(() => { console.error('Recovery already running or state inaccessible.'); process.exitCode = 1; });
}
