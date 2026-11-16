// Every relative import of a Vite config names its file extension (#3057):
// Vite 8's config loader warns about each one without, in every Nx
// project-graph run, and its planned default `configLoader: 'native'`
// (Node's ESM loader) refuses them.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { describe, it } from 'node:test';

const CONFIG_PATTERNS = ['*vite.config.*', '*vitest.config.*'];

/** Relative specifiers of static imports, re-exports and `import()`. */
const RELATIVE_SPECIFIER =
  /(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s*)(['"])(\.\.?\/[^'"]*)\1/gm;

function extensionlessImports(source) {
  return [...source.matchAll(RELATIVE_SPECIFIER)]
    .map(([, , specifier]) => specifier)
    .filter((specifier) => extname(specifier) === '');
}

function trackedViteConfigs() {
  return execFileSync('git', ['ls-files', '--', ...CONFIG_PATTERNS], {
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);
}

describe('extensionlessImports', () => {
  it('finds a relative import, re-export and import() without extension', () => {
    const source = [
      "import { a } from './deploy/a';",
      "export { b } from '../../tools/vite/b';",
      "const c = await import('./c');",
      "import './d';",
    ].join('\n');
    assert.deepEqual(extensionlessImports(source), [
      './deploy/a',
      '../../tools/vite/b',
      './c',
      './d',
    ]);
  });

  it('accepts extensions and package imports', () => {
    const source = [
      "import { a } from './deploy/a.ts';",
      "import analog from '@analogjs/platform';",
      "import { defineConfig } from 'vite';",
    ].join('\n');
    assert.deepEqual(extensionlessImports(source), []);
  });
});

describe('Vite configs', () => {
  const configs = trackedViteConfigs();

  it('are found', () => {
    assert.ok(configs.length > 0, 'no Vite config tracked');
  });

  for (const config of configs) {
    it(`${config} names the file extension of each relative import`, () => {
      assert.deepEqual(
        extensionlessImports(readFileSync(config, 'utf8')),
        [],
        `add the file extension (e.g. '.ts') to these imports of ${config}`
      );
    });
  }
});
