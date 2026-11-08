import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const WORKSPACE_ROOT = resolve(import.meta.dirname, '../..');

/**
 * Nitro aliases for the workspace's `@wolsok/*` path aliases of
 * `tsconfig.base.json`, absolute. Nitro bundles an Analog app's server
 * routes without the tsconfig paths Vite gets from `nxViteTsPaths`, so a
 * lib a route imports needs one. Wildcard entries are left out.
 */
export function nitroTsPathAliases(): Record<string, string> {
  const tsconfig = JSON.parse(
    readFileSync(resolve(WORKSPACE_ROOT, 'tsconfig.base.json'), 'utf8')
  ) as {
    readonly compilerOptions: {
      readonly paths: Readonly<Record<string, readonly string[]>>;
    };
  };
  return Object.fromEntries(
    Object.entries(tsconfig.compilerOptions.paths)
      .filter(([alias]) => alias.startsWith('@wolsok/') && !alias.includes('*'))
      .map(([alias, [target]]) => [alias, resolve(WORKSPACE_ROOT, target)])
  );
}
