import test from 'node:test';
import assert from 'node:assert/strict';
import {recoveryDecision, latestOrigin, stableOrigin} from './web-recovery.mjs';

const broken = {publicHealthy: false, online: true, dockerReady: true, servicesRunning: true,
  localHealthy: true, tunnelStarting: false, failures: 2, sinceAttemptMs: Infinity,
  tunnelReady: false, originKnown: true, originHealthy: false};
for (const [name, patch, expected] of [
  ['healthy public site needs no mutation', {publicHealthy: true}, 'healthy'],
  ['offline does not rotate tunnel', {online: false}, 'offline'],
  ['Docker off is respected', {dockerReady: false}, 'docker-unavailable'],
  ['intentional stop is respected', {servicesRunning: false}, 'services-stopped'],
  ['database or app failure does not rotate tunnel', {localHealthy: false}, 'local-unhealthy'],
  ['warming tunnel is not interrupted', {tunnelStarting: true}, 'tunnel-starting'],
  ['one failure is insufficient', {failures: 1}, 'confirming-failure'],
  ['restart rate is bounded', {sinceAttemptMs: 599999}, 'cooldown'],
  ['expired tunnel is restarted', {}, 'restart-tunnel'],
  ['cooldown boundary permits retry', {sinceAttemptMs: 600000}, 'restart-tunnel'],
  ['healthy tunnel with stale Worker is not rotated', {tunnelReady: true, originHealthy: true}, 'update-origin'],
  ['edge/DNS failure on known ready tunnel does not rotate it', {tunnelReady: true}, 'origin-unreachable'],
  ['lost origin can be rediscovered by controlled restart', {tunnelReady: true, originKnown: false}, 'restart-tunnel'],
]) test(name, () => assert.equal(recoveryDecision({...broken, ...patch}), expected));
test('last valid Quick Tunnel URL wins', () => assert.equal(latestOrigin('https://old-url.trycloudflare.com\nhttps://new-url.trycloudflare.com'), 'https://new-url.trycloudflare.com'));
test('non-Quick-Tunnel addresses are not accepted', () => assert.equal(latestOrigin('https://evil.example https://-bad.trycloudflare.com'), null));
test('read stable URL from quoted dotenv', () => assert.equal(stableOrigin('', 'NEWSAGG_STABLE_URL="https://newsagg.sentsis.workers.dev"'), 'https://newsagg.sentsis.workers.dev'));
test('environment overrides file', () => assert.equal(stableOrigin('https://example.com', 'NEWSAGG_STABLE_URL=https://old.example.com'), 'https://example.com'));
for (const url of ['http://example.com','https://user:pass@example.com','https://example.com/x','https://example.com/?q=1','https://example.com/#x','https://example.com:8443']) {
  test(`reject non-origin URL ${url}`, () => assert.throws(() => stableOrigin(url, '')));
}
