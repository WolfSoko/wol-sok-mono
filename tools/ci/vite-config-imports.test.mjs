// Every relative import a Vite config loads names its file extension
// (#3057): Vite 8's config loader warns about each one without, in every
// Nx project-graph run, and its planned default `configLoader: 'native'`
// (Node's ESM loader) refuses them. The check follows the configs' relative
// imports, so a helper they load (`tools/vite/*.mts`) is held to it too.
//
// Each of those files is an ES module by Node's rules too (#3106): the root
// `package.json` has no `"type": "module"`, so a `.ts` file without a module
// `package.json` closer by loads as CommonJS, and Vite's config loader warns
// "ESM syntax in a file loaded as CommonJS" for it in every project-graph run.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { describe, it } from 'node:test';
import { ROOT } from './workspace-projects.mjs';

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

/** Extensions Node always loads as ES modules. */
const ESM_EXTENSIONS = new Set(['.mts', '.mjs']);

/** Extensions whose format the nearest `package.json`'s `type` decides. */
const PACKAGE_TYPED_EXTENSIONS = new Set(['.ts', '.js']);

/** The `type` of the `package.json` nearest to `file` (a path from the root). */
function nearestPackageType(file, readJson) {
  for (let dir = dirname(file); ; dir = dirname(dir)) {
    const manifest = readJson(join(dir, 'package.json'));
    if (manifest !== undefined) {
      return manifest.type;
    }
    if (dir === dirname(dir)) {
      return undefined;
    }
  }
}

function readSource(file) {
  return readFileSync(join(ROOT, file), 'utf8');
}

function readWorkspaceJson(file) {
  return existsSync(join(ROOT, file))
    ? JSON.parse(readSource(file))
    : undefined;
}

/** Whether Node loads `file` (a path from the root) as an ES module. */
function isEsModule(file, readJson = readWorkspaceJson) {
  const extension = extname(file);
  if (extension === '.json' || ESM_EXTENSIONS.has(extension)) {
    return true;
  }
  return (
    PACKAGE_TYPED_EXTENSIONS.has(extension) &&
    nearestPackageType(file, readJson) === 'module'
  );
}

/**
 * `config` and every file it loads through relative imports, each read once
 * (paths from the root): its relative specifiers, or `missing` where an
 * import names a file that does not exist.
 */
function loadedModules(config) {
  const modules = [];
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) {
      return;
    }
    seen.add(file);
    if (!existsSync(join(ROOT, file))) {
      modules.push({ file, missing: true, specifiers: [] });
      return;
    }
    const specifiers = relativeSpecifiers(readSource(file));
    modules.push({ file, missing: false, specifiers });
    specifiers
      .filter(hasModuleExtension)
      .forEach((specifier) => visit(join(dirname(file), specifier)));
  };
  visit(config);
  return modules;
}

/** Each extensionless relative import, as `<file>: <specifier>`. */
function extensionlessImports(modules) {
  return modules.flatMap(({ file, specifiers }) =>
    specifiers
      .filter((specifier) => !hasModuleExtension(specifier))
      .map((specifier) => `${file}: ${specifier}`)
  );
}

function trackedViteConfigs() {
  return execFileSync('git', ['ls-files', '--', ...CONFIG_PATTERNS], {
    cwd: ROOT,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);
}

describe('relativeSpecifiers', () => {
  it('finds imports, re-exports, side-effect imports and import()', () => {
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

describe('hasModuleExtension', () => {
  it('takes a module extension, not a dotted file name', () => {
    assert.equal(hasModuleExtension('./a.ts'), true);
    assert.equal(hasModuleExtension('./a.mjs'), true);
    assert.equal(hasModuleExtension('./a'), false);
    assert.equal(hasModuleExtension('./vite.shared'), false);
  });
});

describe('isEsModule', () => {
  const manifests = {
    'apps/app/package.json': { type: 'module' },
    'libs/lib/package.json': { name: 'lib' },
    'package.json': { name: 'root' },
  };
  const readJson = (file) => manifests[file];

  it('takes .mts, .mjs and .json as they are', () => {
    assert.equal(isEsModule('libs/lib/vite.config.mts', readJson), true);
    assert.equal(isEsModule('tools/vite/a.mjs', readJson), true);
    assert.equal(isEsModule('tools/vite/a.json', readJson), true);
  });

  it('takes .ts and .js by the nearest package.json', () => {
    assert.equal(isEsModule('apps/app/deploy/a.ts', readJson), true);
    assert.equal(isEsModule('libs/lib/vite.config.ts', readJson), false);
    assert.equal(isEsModule('tools/vite/a.js', readJson), false);
  });

  it('never takes .cts or .cjs', () => {
    assert.equal(isEsModule('apps/app/a.cts', readJson), false);
    assert.equal(isEsModule('apps/app/a.cjs', readJson), false);
  });
});

describe('Vite configs', () => {
  const configs = trackedViteConfigs();

  it('are found', () => {
    assert.ok(configs.length > 0, 'no Vite config tracked');
  });

  for (const config of configs) {
    const modules = loadedModules(config);

    it(`${config} and what it loads name each relative import's extension`, () => {
      assert.deepEqual(
        extensionlessImports(modules),
        [],
        `add the file extension (e.g. '.ts') to these imports`
      );
    });

    it(`${config} and what it loads import only files that exist`, () => {
      assert.deepEqual(
        modules.filter(({ missing }) => missing).map(({ file }) => file),
        [],
        `these imports name no file: a rename left them behind`
      );
    });

    it(`${config} and what it loads are ES modules`, () => {
      assert.deepEqual(
        modules
          .filter(({ missing, file }) => !missing && !isEsModule(file))
          .map(({ file }) => file),
        [],
        `these load as CommonJS: rename them to .mts or .mjs, or put them under a package.json with "type": "module"`
      );
    });
  }
});
