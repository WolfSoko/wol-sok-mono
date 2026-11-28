// Fails when the built-in shaders of @wolsok/loading-wave (its secondary
// entry `@wolsok/loading-wave/shaders`) reach what the shell loads at start:
// the scripts index.html starts, the bootstrap chunk behind main.ts' async
// boundary, every chunk they import statically and the shared bundles
// (the main `_wolsok_loading_wave-*.js` among them) they import by name.
// Only the lazy playground (/loadingWavePlayground) may load them (#3278).
//
//   node tools/angular-examples/check-lazy-shaders.mjs dist/apps/angular-examples

import { readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  BuildCheckError,
  eagerScripts,
  leakedSources,
  sharedBundles,
} from '../build-checks/eager-sources.mjs';

const WORKSPACE_ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const SHADERS_ENTRY = 'libs/public/ws-loading-wave/src/shaders.ts';
export const MAIN_ENTRY = '@wolsok/loading-wave';

const SCRIPT_EXTENSION = /\.[cm]?[jt]s$/;
const RELATIVE_RE_EXPORT =
  /export\s+(?:type\s+)?(?:\*|\{[^}]*\})(?:\s+as\s+[\w$]+)?\s+from\s+["'](\.{1,2}\/[^"']+)["']/g;

/**
 * The workspace paths of the modules the shaders entry re-exports, as the
 * source maps name them (`…/x.shader.ts`).
 */
export function shaderSources(
  workspaceRoot = WORKSPACE_ROOT,
  entry = SHADERS_ENTRY
) {
  const code = readFileSync(join(workspaceRoot, entry), 'utf8');
  const sources = [...code.matchAll(RELATIVE_RE_EXPORT)].map(
    ([, specifier]) => {
      const path = posix.join(posix.dirname(entry), specifier);
      return SCRIPT_EXTENSION.test(path) ? path : `${path}.ts`;
    }
  );
  if (sources.length === 0) {
    throw new BuildCheckError(`No re-exports found in ${entry}.`);
  }
  return sources;
}

/** Runs the check on `dist`; returns the exit code. */
export function checkLazyShaders(dist, sources = shaderSources()) {
  const scripts = eagerScripts(dist, {
    followShared: true,
    crossMainBoundary: true,
  });
  const mainBundle = sharedBundles(dist).get(MAIN_ENTRY);
  if (mainBundle === undefined || !scripts.includes(mainBundle)) {
    throw new BuildCheckError(
      `The shared bundle of ${MAIN_ENTRY} is not among the scripts loaded at start - the check would inspect the wrong set.`
    );
  }
  const leaks = leakedSources(dist, scripts, (source) =>
    sources.some((shader) => source === shader || source.endsWith(`/${shader}`))
  );
  if (leaks.length > 0) {
    console.error(
      `The shaders of ${MAIN_ENTRY}/shaders leaked into what the shell loads at start:\n  ` +
        leaks.join('\n  ')
    );
    return 1;
  }
  console.log(
    `The shaders of ${MAIN_ENTRY}/shaders stay lazy: none of ${scripts.length} scripts loaded at start holds them:\n  ` +
      scripts.join('\n  ')
  );
  return 0;
}

function main(dist) {
  if (dist === undefined) {
    console.error(
      'Usage: check-lazy-shaders.mjs <dist folder with index.html>'
    );
    return 2;
  }
  try {
    return checkLazyShaders(dist);
  } catch (error) {
    if (!(error instanceof BuildCheckError)) {
      throw error;
    }
    console.error(error.message);
    return 2;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = main(process.argv[2]);
}
