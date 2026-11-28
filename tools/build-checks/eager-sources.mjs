// What a federation build loads at start, and which sources it holds.
//
// `eagerScripts` starts at the local scripts `index.html` loads (and any
// extra entry, say a remote's exposed `Routes-*.js`) and follows static
// imports and re-exports; `import(...)` is what stays lazy. `leakedSources`
// reads each script's source map, which names the inputs of the chunk - a
// marker string would not survive minification.
//
// Used by the checks that keep lazy code out of the start:
// tools/bacteria-game/check-lazy-admin.mjs and
// tools/angular-examples/check-lazy-shaders.mjs.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** A dist folder the check cannot judge: the CLI exits with code 2. */
export class BuildCheckError extends Error {}

const LOCAL_SCRIPT_SRC = /<script[^>]*\ssrc="([^"]+\.js)"/g;
const EXTERNAL_URL = /^[a-z]+:\/\//i;
const MAIN_SCRIPT = /^main-[\w-]+\.js$/;
const RELATIVE_SCRIPT = /^\.\/[^"']+\.js$/;
const STATIC_IMPORT =
  /(?:^|[;}\s])(?:import|export)\s*(?:[\w$*{}\s,]+?\s*from\s*)?["']([^"']+)["']/g;
const DYNAMIC_IMPORT = /import\(\s*["'](\.\/[^"']+\.js)["']\s*\)/g;

/**
 * The scripts loaded at start, sorted.
 *
 * - `extraEntries`: more scripts loaded at start, relative to `dist`.
 * - `followShared`: follow bare specifiers to the shared bundles the build
 *   maps them to (`remoteEntry.json`'s `shared`, `importmap.json`'s
 *   `imports`), as Native Federation's import map does at runtime.
 * - `crossMainBoundary`: count the dynamic imports of `main-*.js` itself as
 *   loaded at start, since a federation app's `main.ts` only starts
 *   federation and then loads `./bootstrap` behind an `import()`.
 */
export function eagerScripts(
  dist,
  { extraEntries = [], followShared = false, crossMainBoundary = false } = {}
) {
  const entries = [...indexScripts(dist), ...extraEntries];
  const resolveShared = followShared ? sharedBundles(dist) : new Map();

  const reached = new Set();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = withoutDotSlash(queue.pop());
    if (reached.has(file)) {
      continue;
    }
    reached.add(file);
    const code = readFileSync(join(dist, file), 'utf8');
    for (const [, specifier] of code.matchAll(STATIC_IMPORT)) {
      const imported = RELATIVE_SCRIPT.test(specifier)
        ? specifier
        : resolveShared.get(specifier);
      if (imported !== undefined) {
        queue.push(imported);
      }
    }
    if (crossMainBoundary && MAIN_SCRIPT.test(file)) {
      for (const [, imported] of code.matchAll(DYNAMIC_IMPORT)) {
        queue.push(imported);
      }
    }
  }
  return [...reached].sort((a, b) => a.localeCompare(b));
}

/** `script: source` for every source of `scripts` that `isForbidden` names. */
export function leakedSources(dist, scripts, isForbidden) {
  const leaks = [];
  for (const file of scripts) {
    const map = join(dist, `${file}.map`);
    if (!existsSync(map)) {
      throw new BuildCheckError(
        `No source map for ${file} - build with source maps.`
      );
    }
    const { sources = [] } = JSON.parse(readFileSync(map, 'utf8'));
    for (const source of sources.filter(isForbidden)) {
      leaks.push(`${file}: ${source}`);
    }
  }
  return leaks;
}

function indexScripts(dist) {
  const index = join(dist, 'index.html');
  if (!existsSync(index)) {
    throw new BuildCheckError(`No index.html in ${dist}`);
  }
  const scripts = [...readFileSync(index, 'utf8').matchAll(LOCAL_SCRIPT_SRC)]
    .map((match) => withoutDotSlash(match[1]))
    .filter((src) => !EXTERNAL_URL.test(src));
  if (!scripts.some((file) => MAIN_SCRIPT.test(file))) {
    throw new BuildCheckError(`No main script found in ${dist}/index.html`);
  }
  return scripts;
}

/** Bare specifier to the shared bundle's file, as the federation build maps them. */
function sharedBundles(dist) {
  const remoteEntry = join(dist, 'remoteEntry.json');
  if (!existsSync(remoteEntry)) {
    throw new BuildCheckError(
      `No remoteEntry.json in ${dist} - not a federation build.`
    );
  }
  const { shared = [] } = JSON.parse(readFileSync(remoteEntry, 'utf8'));
  const importMap = join(dist, 'importmap.json');
  const { imports = {} } = existsSync(importMap)
    ? JSON.parse(readFileSync(importMap, 'utf8'))
    : {};
  return new Map([
    ...Object.entries(imports),
    ...shared.map(({ packageName, outFileName }) => [packageName, outFileName]),
  ]);
}

function withoutDotSlash(file) {
  return file.replace(/^\.\//, '');
}
