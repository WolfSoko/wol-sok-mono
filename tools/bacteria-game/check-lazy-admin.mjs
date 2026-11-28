// Fails when the game's admin area (ADR 0012) reaches what every visitor
// loads: the scripts index.html starts, the exposed `Routes` the shell
// loads, and every chunk they import statically. The admin lib must stay in
// the chunks its lazy `/admin` route fetches.
//
//   node tools/bacteria-game/check-lazy-admin.mjs dist/apps/bacteria-game-remote

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  BuildCheckError,
  eagerScripts,
  leakedSources,
} from '../build-checks/eager-sources.mjs';

const ADMIN_SOURCES = 'libs/features/lazy/bacteria-wars-admin/';

const dist = process.argv[2];
if (dist === undefined || !existsSync(join(dist, 'index.html'))) {
  console.error('Usage: check-lazy-admin.mjs <dist folder with index.html>');
  process.exit(2);
}

try {
  // The module the shell loads through Native Federation.
  const routes = readdirSync(dist).filter((file) =>
    /^Routes-[\w-]+\.js$/.test(file)
  );
  const scripts = eagerScripts(dist, { extraEntries: routes });
  const leaks = leakedSources(dist, scripts, (source) =>
    source.includes(ADMIN_SOURCES)
  );
  if (leaks.length > 0) {
    console.error(
      'The admin area leaked into what every visitor loads:\n  ' +
        leaks.join('\n  ')
    );
    process.exit(1);
  }
  console.log(
    `The admin area stays lazy: none of ${scripts.length} eagerly loaded scripts holds it.`
  );
} catch (error) {
  if (!(error instanceof BuildCheckError)) {
    throw error;
  }
  console.error(error.message);
  process.exit(2);
}
