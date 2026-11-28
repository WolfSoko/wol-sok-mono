import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  distFixture,
  emptyDistFixture,
  removeDistFixtures,
} from './dist-fixture.mjs';
import {
  BuildCheckError,
  eagerScripts,
  importedScripts,
  leakedSources,
} from './eager-sources.mjs';

afterEach(removeDistFixtures);

const SHARED = {
  'remoteEntry.json': JSON.stringify({
    name: 'shell',
    shared: [{ packageName: '@wolsok/lib', outFileName: '_wolsok_lib-L.js' }],
    exposes: [],
  }),
  'importmap.json': JSON.stringify({
    imports: { '@angular/core': '_angular_core.C.js' },
  }),
};

void describe('eagerScripts', () => {
  void it('starts at the local scripts index.html loads and follows static imports and re-exports', () => {
    const dist = distFixture({
      'main-M.js': 'import{a}from"./chunk-A.js";import"./chunk-B.js";',
      'chunk-A.js': 'export*from"./chunk-C.js";',
      'chunk-B.js': '',
      'chunk-C.js': '',
    });

    assert.deepEqual(eagerScripts(dist), [
      'chunk-A.js',
      'chunk-B.js',
      'chunk-C.js',
      'main-M.js',
      'polyfills-P.js',
    ]);
  });

  void it('leaves dynamic imports lazy', () => {
    const dist = distFixture({
      'main-M.js': 'import"./chunk-A.js";',
      'chunk-A.js': 'const r=()=>import("./chunk-LAZY.js");',
      'chunk-LAZY.js': '',
    });

    assert.ok(!eagerScripts(dist).includes('chunk-LAZY.js'));
  });

  void it('adds the extra entries', () => {
    const dist = distFixture({
      'main-M.js': '',
      'Routes-R.js': 'import"./chunk-A.js";',
      'chunk-A.js': '',
    });

    const scripts = eagerScripts(dist, { extraEntries: ['Routes-R.js'] });

    assert.ok(scripts.includes('Routes-R.js'));
    assert.ok(scripts.includes('chunk-A.js'));
  });

  void it("crosses main's async boundary only when asked", () => {
    const dist = distFixture({
      'main-M.js': 'init().then(()=>import("./chunk-BOOT.js"));',
      'chunk-BOOT.js':
        'import"./chunk-APP.js";const r=()=>import("./chunk-LAZY.js");',
      'chunk-APP.js': '',
      'chunk-LAZY.js': '',
    });

    assert.ok(!eagerScripts(dist).includes('chunk-BOOT.js'));
    const crossed = eagerScripts(dist, { crossMainBoundary: true });
    assert.ok(crossed.includes('chunk-BOOT.js'));
    assert.ok(crossed.includes('chunk-APP.js'));
    assert.ok(!crossed.includes('chunk-LAZY.js'));
  });

  void it('follows shared bundles through remoteEntry.json and importmap.json only when asked', () => {
    const dist = distFixture({
      ...SHARED,
      'main-M.js':
        'import{L}from"@wolsok/lib";import{C}from"@angular/core";import"@unknown/pkg";',
      '_wolsok_lib-L.js': 'import{x}from"@nf-internal/chunk-N";',
      '_angular_core.C.js': '',
    });

    assert.ok(!eagerScripts(dist).includes('_wolsok_lib-L.js'));
    const followed = eagerScripts(dist, { followShared: true });
    assert.ok(followed.includes('_wolsok_lib-L.js'));
    assert.ok(followed.includes('_angular_core.C.js'));
  });

  void it('refuses a dist folder without index.html or main script', () => {
    const empty = emptyDistFixture();
    assert.throws(() => eagerScripts(empty), BuildCheckError);

    const noMain = distFixture({
      'index.html': '<script src="polyfills-P.js" type="module"></script>',
    });
    assert.throws(
      () => eagerScripts(noMain),
      new BuildCheckError(`No main script found in ${noMain}/index.html`)
    );
  });

  void it('refuses to follow shared bundles without remoteEntry.json', () => {
    const dist = distFixture({ 'main-M.js': '' });

    assert.throws(
      () => eagerScripts(dist, { followShared: true }),
      BuildCheckError
    );
  });
});

void describe('importedScripts', () => {
  void it('starts at the given scripts instead of index.html', () => {
    const dist = distFixture({
      'main-M.js': 'import"./chunk-A.js";',
      'chunk-A.js': '',
      'chunk-B.js': 'import"./chunk-C.js";',
      'chunk-C.js': '',
    });

    assert.deepEqual(importedScripts(dist, ['chunk-B.js']), [
      'chunk-B.js',
      'chunk-C.js',
    ]);
  });
});

void describe('leakedSources', () => {
  const isSecret = (source) => source.includes('libs/secret/');

  void it('names each script and the forbidden source it holds', () => {
    const dist = distFixture(
      { 'main-M.js': '', 'chunk-A.js': '' },
      {
        'main-M.js': ['apps/shell/src/main.ts'],
        'chunk-A.js': ['../../../libs/secret/a.ts', 'apps/shell/src/b.ts'],
      }
    );

    assert.deepEqual(
      leakedSources(dist, ['main-M.js', 'chunk-A.js'], isSecret),
      ['chunk-A.js: ../../../libs/secret/a.ts']
    );
  });

  void it('refuses a script without source map', () => {
    const dist = distFixture({ 'main-M.js': '' }, { 'main-M.js': null });

    assert.throws(
      () => leakedSources(dist, ['main-M.js'], isSecret),
      new BuildCheckError(
        'No source map for main-M.js - build with source maps.'
      )
    );
  });
});
