// Lighthouse CI for an app's public pages (ADR 0014, gate 4), report-only:
//   node tools/perf/lighthouse-run.mjs <app>
// The app's `lighthouse.json` says what to serve and which pages; the rest
// is set here, and the two go to `lhci autorun` as one config. The
// assertions only warn, so the run fails only when nothing could be
// measured. Chrome is Playwright's, which the CI workers have for the e2e
// tasks; lhci's health check finds it only through CHROME_PATH, set here
// unless it is set already.
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Warnings at the marks Lighthouse calls good on mobile; total byte weight
 * at its own "avoid enormous network payloads" mark.
 */
const ASSERTIONS = {
  'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
  'total-blocking-time': ['warn', { maxNumericValue: 200 }],
  'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
  'total-byte-weight': ['warn', { maxNumericValue: 1_600_000 }],
};

const app = process.argv[2];
if (!app) {
  console.error('Usage: node tools/perf/lighthouse-run.mjs <app>');
  process.exit(2);
}
const { $comment, ...collect } = JSON.parse(
  readFileSync(join('apps', app, 'lighthouse.json'), 'utf8')
);
void $comment;
const config = {
  ci: {
    collect: {
      numberOfRuns: 3,
      settings: { chromeFlags: '--no-sandbox --headless=new' },
      ...collect,
    },
    assert: { assertions: ASSERTIONS },
    // In CI to Google's temporary public storage (a link per page in the
    // log, kept a few days); elsewhere into .lighthouseci/.
    upload: process.env['CI']
      ? { target: 'temporary-public-storage' }
      : { target: 'filesystem', outputDir: '.lighthouseci' },
  },
};
const configFile = join(tmpdir(), `lighthouserc-${app}-${process.pid}.json`);
writeFileSync(configFile, JSON.stringify(config));

const { chromium } = createRequire(import.meta.url)('playwright');
const { status } = spawnSync(
  'npx',
  ['lhci', 'autorun', `--config=${configFile}`],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      CHROME_PATH: process.env['CHROME_PATH'] ?? chromium.executablePath(),
    },
  }
);
rmSync(configFile, { force: true });
process.exit(status ?? 1);
