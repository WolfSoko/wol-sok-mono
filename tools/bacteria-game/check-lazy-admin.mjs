// Fails when the game's admin area (ADR 0012) reaches what every visitor
// loads at start: the scripts index.html starts, the bootstrap chunk behind
// main.ts' `import('./bootstrap')`, the exposed `Routes` the shell loads,
// every chunk they import statically and the shared bundles they import by
// name. The admin lib must stay in the chunks its lazy `/admin` route
// fetches (#3282).
//
//   node tools/bacteria-game/check-lazy-admin.mjs dist/apps/bacteria-game-remote

import { existsSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  BuildCheckError,
  eagerScripts,
  leakedSources,
} from '../build-checks/eager-sources.mjs';

const ADMIN_SOURCES = 'libs/features/lazy/bacteria-wars-admin/';
export const BOOTSTRAP_SOURCE = 'apps/bacteria-game-remote/src/bootstrap.ts';
// The module the shell loads through Native Federation.
const EXPOSED_ROUTES = /^Routes-[\w-]+\.js$/;

/** Runs the check on `dist`; returns the exit code. */
export function checkLazyAdmin(dist) {
  try {
    return reportLeaks(dist);
  } catch (error) {
    if (!(error instanceof BuildCheckError)) {
      throw error;
    }
    console.error(error.message);
    return 2;
  }
}

function reportLeaks(dist) {
  const scripts = eagerScripts(dist, {
    extraEntries: exposedRoutes(dist),
    followShared: true,
    crossMainBoundary: true,
  });
  assertBootstrapReached(dist, scripts);
  const leaks = leakedSources(dist, scripts, (source) =>
    source.includes(ADMIN_SOURCES)
  );
  if (leaks.length > 0) {
    console.error(
      'The admin area leaked into what every visitor loads at start:\n  ' +
        leaks.join('\n  ')
    );
    return 1;
  }
  console.log(
    `The admin area stays lazy: none of ${scripts.length} scripts loaded at start holds it:\n  ` +
      scripts.join('\n  ')
  );
  return 0;
}

function exposedRoutes(dist) {
  if (!existsSync(dist)) {
    throw new BuildCheckError(`No dist folder ${dist}`);
  }
  return readdirSync(dist).filter((file) => EXPOSED_ROUTES.test(file));
}

/**
 * The bootstrap chunk must be among the scripts: proof that the traversal
 * crossed main.ts' async boundary, without which it would inspect only the
 * federation start-up.
 */
function assertBootstrapReached(dist, scripts) {
  const holders = leakedSources(dist, scripts, (source) =>
    source.endsWith(BOOTSTRAP_SOURCE)
  );
  if (holders.length === 0) {
    throw new BuildCheckError(
      `None of the scripts loaded at start holds ${BOOTSTRAP_SOURCE} - the check would inspect the wrong set.`
    );
  }
}

function main(dist) {
  if (dist === undefined) {
    console.error('Usage: check-lazy-admin.mjs <dist folder with index.html>');
    return 2;
  }
  return checkLazyAdmin(dist);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = main(process.argv[2]);
}
