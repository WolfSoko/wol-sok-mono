// Fixture dist folders for the specs of the build checks: an index.html that
// loads `polyfills-P.js` and `main-M.js`, and a source map beside each script.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export const INDEX_HTML = `<!doctype html><html><head>
<script src="https://www.googletagmanager.com/gtag/js"></script>
<script src="polyfills-P.js" type="module"></script>
<script src="main-M.js" type="module-shim"></script>
</head></html>`;

const created = [];

/**
 * A temporary dist folder holding `files` (path to content) beside the
 * default `index.html` and `polyfills-P.js`. Every `.js` file gets a source
 * map listing `sources[path]` (none when absent); `null` leaves the map out.
 */
export function distFixture(files, sources = {}) {
  const dist = emptyDistFixture();
  for (const [path, content] of Object.entries({
    'index.html': INDEX_HTML,
    'polyfills-P.js': '',
    ...files,
  })) {
    mkdirSync(dirname(join(dist, path)), { recursive: true });
    writeFileSync(join(dist, path), content);
    if (path.endsWith('.js') && sources[path] !== null) {
      writeFileSync(
        join(dist, `${path}.map`),
        JSON.stringify({ version: 3, sources: sources[path] ?? [] })
      );
    }
  }
  return dist;
}

export function emptyDistFixture() {
  const dist = mkdtempSync(join(tmpdir(), 'build-check-'));
  created.push(dist);
  return dist;
}

/** Removes every fixture made so far; call it in `afterEach`. */
export function removeDistFixtures() {
  for (const dist of created.splice(0)) {
    rmSync(dist, { recursive: true, force: true });
  }
}
