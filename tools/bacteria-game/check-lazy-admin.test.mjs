import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import {
  distFixture,
  removeDistFixtures,
} from '../build-checks/dist-fixture.mjs';
import { BOOTSTRAP_SOURCE, checkLazyAdmin } from './check-lazy-admin.mjs';

const ADMIN = '../../../libs/features/lazy/bacteria-wars-admin/src/index.ts';
const BOOTSTRAP = `../../../${BOOTSTRAP_SOURCE}`;

afterEach(() => {
  removeDistFixtures();
  mock.restoreAll();
});

/**
 * A game build: main crosses to a bootstrap chunk, which imports a shared
 * bundle by name and loads the admin route behind an `import()`; the shell
 * loads `Routes-R.js`. `files` and `sources` replace or add entries.
 */
function gameDist(files = {}, sources = {}) {
  return distFixture(
    {
      'remoteEntry.json': JSON.stringify({
        name: 'bacteria-game-remote',
        shared: [
          { packageName: '@wolsok/lib', outFileName: '_wolsok_lib-L.js' },
        ],
        exposes: [{ key: './Routes', outFileName: 'Routes-R.js' }],
      }),
      'main-M.js': 'init().then(()=>import("./chunk-BOOT.js"));',
      'chunk-BOOT.js':
        'import{l}from"@wolsok/lib";const a=()=>import("./chunk-ADMIN.js");',
      'chunk-ADMIN.js': '',
      'Routes-R.js': 'import"./chunk-ROUTES.js";',
      'chunk-ROUTES.js': '',
      '_wolsok_lib-L.js': '',
      ...files,
    },
    {
      'chunk-BOOT.js': [BOOTSTRAP],
      'chunk-ADMIN.js': [ADMIN],
      ...sources,
    }
  );
}

function captureConsole() {
  return {
    log: mock.method(console, 'log', () => undefined),
    error: mock.method(console, 'error', () => undefined),
  };
}

function printed(method) {
  return method.mock.calls.map((call) => call.arguments.join(' ')).join('\n');
}

void describe('checkLazyAdmin', () => {
  void it('passes when the admin stays behind a dynamic import of the bootstrap chunk, listing every script it inspected', () => {
    const output = captureConsole();

    assert.equal(checkLazyAdmin(gameDist()), 0);

    const log = printed(output.log);
    for (const script of [
      '_wolsok_lib-L.js',
      'chunk-BOOT.js',
      'chunk-ROUTES.js',
      'main-M.js',
      'polyfills-P.js',
      'Routes-R.js',
    ]) {
      assert.match(log, new RegExp(`\\n  ${script.replaceAll('.', '\\.')}`));
    }
    assert.doesNotMatch(log, /chunk-ADMIN\.js/);
  });

  void it('fails when the bootstrap chunk holds the admin', () => {
    const output = captureConsole();

    const code = checkLazyAdmin(
      gameDist({}, { 'chunk-BOOT.js': [BOOTSTRAP, ADMIN] })
    );

    assert.equal(code, 1);
    assert.match(
      printed(output.error),
      /chunk-BOOT\.js: .*bacteria-wars-admin/
    );
  });

  void it('fails when a chunk the bootstrap chunk imports statically holds the admin', () => {
    const output = captureConsole();

    const code = checkLazyAdmin(
      gameDist(
        {
          'chunk-BOOT.js':
            'import"./chunk-CONFIG.js";import{l}from"@wolsok/lib";',
          'chunk-CONFIG.js': '',
        },
        { 'chunk-CONFIG.js': [ADMIN] }
      )
    );

    assert.equal(code, 1);
    assert.match(printed(output.error), /chunk-CONFIG\.js: /);
  });

  void it('fails when a shared bundle the bootstrap chunk imports by name holds the admin', () => {
    const output = captureConsole();

    const code = checkLazyAdmin(gameDist({}, { '_wolsok_lib-L.js': [ADMIN] }));

    assert.equal(code, 1);
    assert.match(printed(output.error), /_wolsok_lib-L\.js: /);
  });

  void it('fails when a chunk the exposed Routes import holds the admin', () => {
    const output = captureConsole();

    const code = checkLazyAdmin(gameDist({}, { 'chunk-ROUTES.js': [ADMIN] }));

    assert.equal(code, 1);
    assert.match(printed(output.error), /chunk-ROUTES\.js: /);
  });

  void it('exits 2 when no inspected script holds the bootstrap, since it would inspect the wrong set', () => {
    const output = captureConsole();

    const code = checkLazyAdmin(gameDist({ 'main-M.js': 'init();' }));

    assert.equal(code, 2);
    assert.match(printed(output.error), /bootstrap\.ts/);
  });

  void it('exits 2 when no inspected script is a shared bundle, since it would inspect the wrong set', () => {
    const output = captureConsole();

    const code = checkLazyAdmin(
      gameDist({ 'chunk-BOOT.js': 'const a=()=>import("./chunk-ADMIN.js");' })
    );

    assert.equal(code, 2);
    assert.match(printed(output.error), /shared bundle/);
  });

  void it('exits 2 when a script has no source map', () => {
    const output = captureConsole();

    const code = checkLazyAdmin(gameDist({}, { 'chunk-ROUTES.js': null }));

    assert.equal(code, 2);
    assert.match(printed(output.error), /No source map for chunk-ROUTES\.js/);
  });

  void it('exits 2 on a folder without remoteEntry.json', () => {
    const output = captureConsole();

    const code = checkLazyAdmin(distFixture({ 'main-M.js': '' }));

    assert.equal(code, 2);
    assert.match(printed(output.error), /remoteEntry\.json/);
  });

  void it('exits 2 on a path that is a file, not a folder', () => {
    const output = captureConsole();

    const code = checkLazyAdmin('tools/bacteria-game/check-lazy-admin.mjs');

    assert.equal(code, 2);
    assert.match(printed(output.error), /No dist folder/);
  });

  void it('exits 2 on a folder that does not exist', () => {
    const output = captureConsole();

    const code = checkLazyAdmin('tmp/no-such-dist-folder');

    assert.equal(code, 2);
    assert.match(printed(output.error), /No dist folder/);
  });
});
