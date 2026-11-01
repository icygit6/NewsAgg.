import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { BRAND_ASSET_VERSION } from '../constants';

// The brand images are cached for a long time at the edge, so every reference carries the same
// ?v= key. Files outside the bundle cannot import the constant; this keeps them in step with it.
const files = ['index.html', 'public/manifest.webmanifest', 'public/research-foundations.html', '../server/scripts/daily-email.mjs'];
const brandUrl = /\/(?:favicon|apple-touch-icon|icon-\d+|icon-maskable|logo-mark(?:-\d+)?|og-image)\.(?:png|ico)\?v=([\w.-]+)/g;

it.each(files)('%s uses the current brand asset version', (file) => {
  const text = readFileSync(resolve(process.cwd(), file), 'utf8');
  const versions = [...text.matchAll(brandUrl)].map((match) => match[1]);
  expect(versions.length).toBeGreaterThan(0);
  expect(new Set(versions)).toEqual(new Set([BRAND_ASSET_VERSION]));
});
