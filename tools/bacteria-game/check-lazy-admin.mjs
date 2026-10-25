// Fails when the game's admin area (ADR 0012) reaches what every visitor
// loads: the scripts index.html starts, the exposed `Routes` the shell
// loads, and every chunk they import statically. The admin lib must stay in
// the chunks its lazy `/admin` route fetches.
//
// It reads the build's source maps, which name the inputs of each chunk -
// a marker string would not survive minification.
//
//   node tools/bacteria-game/check-lazy-admin.mjs dist/apps/bacteria-game-remote

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ADMIN_SOURCES = 'libs/features/lazy/bacteria-wars-admin/';

const dist = process.argv[2];
if (dist === undefined || !existsSync(join(dist, 'index.html'))) {
  console.error('Usage: check-lazy-admin.mjs <dist folder with index.html>');
  process.exit(2);
}

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const entries = [
  ...[...html.matchAll(/<script[^>]*\ssrc="([^"]+\.js)"/g)]
    .map((match) => match[1])
    .filter((src) => !/^[a-z]+:\/\//i.test(src)),
  // The module the shell loads through Native Federation.
  ...readdirSync(dist).filter((file) => /^Routes-[\w-]+\.js$/.test(file)),
];
if (!entries.some((file) => file.startsWith('main-'))) {
  console.error(`No main script found in ${dist}/index.html`);
  process.exit(2);
}

// Static imports and re-exports only: `import(...)` is what stays lazy.
const STATIC_IMPORT =
  /(?:^|[;}\s])(?:import|export)\s*(?:[\w$*{}\s,]+?\s*from\s*)?["'](\.\/[^"']+\.js)["']/g;

const reached = new Set();
const queue = [...entries];
while (queue.length > 0) {
  const file = queue.pop().replace(/^\.\//, '');
  if (reached.has(file)) {
    continue;
  }
  reached.add(file);
  const code = readFileSync(join(dist, file), 'utf8');
  for (const [, imported] of code.matchAll(STATIC_IMPORT)) {
    queue.push(imported);
  }
}

const leaks = [];
for (const file of reached) {
  const map = join(dist, `${file}.map`);
  if (!existsSync(map)) {
    console.error(`No source map for ${file} - build with source maps.`);
    process.exit(2);
  }
  const { sources = [] } = JSON.parse(readFileSync(map, 'utf8'));
  for (const source of sources) {
    if (source.includes(ADMIN_SOURCES)) {
      leaks.push(`${file}: ${source}`);
    }
  }
}

if (leaks.length > 0) {
  console.error(
    'The admin area leaked into what every visitor loads:\n  ' +
      leaks.join('\n  ')
  );
  process.exit(1);
}
console.log(
  `The admin area stays lazy: none of ${reached.size} eagerly loaded scripts holds it.`
);
