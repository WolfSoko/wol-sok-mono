import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, it, mock } from 'node:test';
import {
  distFixture,
  emptyDistFixture,
  removeDistFixtures,
} from '../build-checks/dist-fixture.mjs';
import { BuildCheckError } from '../build-checks/eager-sources.mjs';
import {
  checkLazyShaders,
  shaderSources,
  SHADERS_ENTRY,
} from './check-lazy-shaders.mjs';

const SHADER =
  'libs/public/ws-loading-wave/src/lib/webgl/shaders/spark-front.shader.ts';
const RIPPLE =
  'libs/public/ws-loading-wave/src/lib/webgl/shaders/ripple.shader.ts';

afterEach(() => {
  removeDistFixtures();
  mock.restoreAll();
});

/** A shell build: main crosses to a bootstrap chunk that imports the main loading-wave bundle. */
function shellDist({
  mainBundleSources,
  bootstrap = 'import{L}from"@wolsok/loading-wave";',
}) {
  return distFixture(
    {
      'remoteEntry.json': JSON.stringify({
        name: 'shell',
        shared: [
          {
            packageName: '@wolsok/loading-wave',
            outFileName: '_wolsok_loading_wave-W.js',
          },
          {
            packageName: '@wolsok/loading-wave/shaders',
            outFileName: '_wolsok_loading_wave_shaders-S.js',
          },
        ],
        exposes: [],
      }),
      'main-M.js': 'init().then(()=>import("./chunk-BOOT.js"));',
      'chunk-BOOT.js': `${bootstrap}const p=()=>import("./chunk-PLAYGROUND.js");`,
      'chunk-PLAYGROUND.js': 'import{S}from"@wolsok/loading-wave/shaders";',
      '_wolsok_loading_wave-W.js': '',
      '_wolsok_loading_wave_shaders-S.js': '',
    },
    {
      '_wolsok_loading_wave-W.js': mainBundleSources,
      '_wolsok_loading_wave_shaders-S.js': [`../../../${SHADER}`],
    }
  );
}

function captureConsole() {
  return {
    log: mock.method(console, 'log', () => undefined),
    error: mock.method(console, 'error', () => undefined),
  };
}

void describe('shaderSources', () => {
  void it('reads the modules the shaders entry re-exports, without the default ripple', () => {
    const sources = shaderSources();

    assert.equal(sources.length, 5);
    assert.ok(sources.includes(SHADER));
    assert.ok(!sources.includes(RIPPLE));
  });

  void it('refuses an entry without re-exports', () => {
    const root = emptyDistFixture();
    mkdirSync(join(root, 'libs/public/ws-loading-wave/src'), {
      recursive: true,
    });
    writeFileSync(join(root, SHADERS_ENTRY), 'export const nothing = 1;\n');

    assert.throws(() => shaderSources(root), BuildCheckError);
  });
});

void describe('checkLazyShaders', () => {
  void it('passes while only the lazy playground imports the shaders, listing the scripts it inspected', () => {
    const output = captureConsole();
    const dist = shellDist({ mainBundleSources: [`../../../${RIPPLE}`] });

    assert.equal(checkLazyShaders(dist, [SHADER]), 0);
    const message = output.log.mock.calls[0].arguments[0];
    assert.match(message, /none of 4 scripts loaded at start/);
    for (const script of [
      'main-M.js',
      'polyfills-P.js',
      'chunk-BOOT.js',
      '_wolsok_loading_wave-W.js',
    ]) {
      assert.ok(message.includes(script), script);
    }
    assert.ok(!message.includes('chunk-PLAYGROUND.js'));
  });

  void it('fails naming the shaders bundle when shell code imports the shaders', () => {
    const output = captureConsole();
    const dist = shellDist({
      mainBundleSources: [],
      bootstrap:
        'import{L}from"@wolsok/loading-wave";import{S}from"@wolsok/loading-wave/shaders";',
    });

    assert.equal(checkLazyShaders(dist, [SHADER]), 1);
    assert.match(
      output.error.mock.calls[0].arguments[0],
      /_wolsok_loading_wave_shaders-S\.js: \.\.\/\.\.\/\.\.\/libs\/public\/ws-loading-wave\/src\/lib\/webgl\/shaders\/spark-front\.shader\.ts/
    );
  });

  void it('fails naming the main bundle when the main entry re-exports the shaders', () => {
    const output = captureConsole();
    const dist = shellDist({
      mainBundleSources: [`../../../${RIPPLE}`, `../../../${SHADER}`],
    });

    assert.equal(checkLazyShaders(dist, [SHADER]), 1);
    assert.match(
      output.error.mock.calls[0].arguments[0],
      /_wolsok_loading_wave-W\.js: .*spark-front/
    );
  });

  void it('refuses to pass when the main loading-wave bundle is not loaded at start', () => {
    captureConsole();
    const dist = shellDist({ mainBundleSources: [], bootstrap: '' });

    assert.throws(() => checkLazyShaders(dist, [SHADER]), BuildCheckError);
  });
});
