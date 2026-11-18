// Every relative import a Vite config loads names its file extension
// (#3057): Vite 8's config loader warns about each one without, in every
// Nx project-graph run, and its planned default `configLoader: 'native'`
// (Node's ESM loader) refuses them. The check follows the configs' relative
// imports, so a helper they load (`tools/vite/*.ts`) is held to it too.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { describe, it } from 'node:test';
import { ROOT, gitLsFiles } from './workspace-projects.mjs';

const CONFIG_PATTERNS = ['*vite.config.*', '*vitest.config.*'];

/** What Node's ESM loader takes as a module's file extension. */
const MODULE_EXTENSIONS = new Set([
  '.ts',
  '.mts',
  '.cts',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
]);

/** Relative specifiers of static imports, re-exports and `import()`. */
const RELATIVE_SPECIFIER =
  /(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s*)(['"])(\.\.?\/[^'"]*)\1/gm;

function relativeSpecifiers(source) {
  return [...source.matchAll(RELATIVE_SPECIFIER)].map(
    ([, , specifier]) => specifier
  );
}

function hasModuleExtension(specifier) {
  return MODULE_EXTENSIONS.has(extname(specifier));
}

/**
 * Each extensionless relative import of `file` and of every file it loads
 * through relative imports, as `<file>: <specifier>` (paths from the root).
 */
function extensionlessImportsFrom(file, seen = new Set()) {
  if (seen.has(file) || !existsSync(join(ROOT, file))) {
    return [];
  }
  seen.add(file);
  const specifiers = relativeSpecifiers(readFileSync(join(ROOT, file), 'utf8'));
  return specifiers.flatMap((specifier) =>
    hasModuleExtension(specifier)
      ? extensionlessImportsFrom(join(dirname(file), specifier), seen)
      : [`${file}: ${specifier}`]
  );
}

function trackedViteConfigs() {
  return gitLsFiles(...CONFIG_PATTERNS);
}

void describe('relativeSpecifiers', () => {
  void it('finds imports, re-exports, side-effect imports and import()', () => {
    const source = [
      "import { a } from './deploy/a';",
      "export * from '../../tools/vite/b';",
      "const c = await import('./c');",
      "import './d';",
      'import {\n  e,\n} from "./e.ts";',
      "import { defineConfig } from 'vite';",
    ].join('\n');
    assert.deepEqual(relativeSpecifiers(source), [
      './deploy/a',
      '../../tools/vite/b',
      './c',
      './d',
      './e.ts',
    ]);
  });
});

void describe('hasModuleExtension', () => {
  void it('takes a module extension, not a dotted file name', () => {
    assert.equal(hasModuleExtension('./a.ts'), true);
    assert.equal(hasModuleExtension('./a.mjs'), true);
    assert.equal(hasModuleExtension('./a'), false);
    assert.equal(hasModuleExtension('./vite.shared'), false);
  });
});

void describe('Vite configs', () => {
  const configs = trackedViteConfigs();

  void it('are found', () => {
    assert.ok(configs.length > 0, 'no Vite config tracked');
  });

  for (const config of configs) {
    void it(`${config} and what it loads name each relative import's extension`, () => {
      assert.deepEqual(
        extensionlessImportsFrom(config),
        [],
        `add the file extension (e.g. '.ts') to these imports`
      );
    });
  }
});
