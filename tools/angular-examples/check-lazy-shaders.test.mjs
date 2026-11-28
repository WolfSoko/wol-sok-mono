import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, posix } from 'node:path';
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

/** A workspace root holding the shaders entry with `code` and the `files` beside it. */
function entryFixture(code, files) {
  const root = emptyDistFixture();
  const src = join(root, posix.dirname(SHADERS_ENTRY));
  mkdirSync(join(src, 'lib'), { recursive: true });
  writeFileSync(join(root, SHADERS_ENTRY), code);
  for (const file of files) {
    writeFileSync(join(src, file), '');
  }
  return root;
}

function captureConsole() {
  return {
    log: mock.method(console, 'log', () => undefined),
    error: mock.method(console, 'error', () => undefined),
  };
}

void describe('shaderSources', () => {
  void it('reads the modules the shaders entry re-exports, without the default ripple', () => {
    // only facts that hold whatever shaders the entry gains or loses: the
    // file is no input of tools:test, so a lib change never reruns this
    const sources = shaderSources();

    assert.ok(sources.length > 0);
    assert.ok(!sources.includes(RIPPLE));
  });

  void it('maps extensionless and .js specifiers to the TypeScript file', () => {
    const root = entryFixture(
      "export { a } from './lib/a.shader';\nexport { b } from './lib/b.shader.js';\n",
      ['lib/a.shader.ts', 'lib/b.shader.ts']
    );

    assert.deepEqual(shaderSources(root), [
      'libs/public/ws-loading-wave/src/lib/a.shader.ts',
      'libs/public/ws-loading-wave/src/lib/b.shader.ts',
    ]);
  });

  void it('leaves out type-only re-exports', () => {
    const root = entryFixture(
      "export type { T } from './lib/types';\nexport { type U, type V } from './lib/more-types';\nexport { a, type A } from './lib/a.shader';\n",
      ['lib/types.ts', 'lib/more-types.ts', 'lib/a.shader.ts']
    );

    assert.deepEqual(shaderSources(root), [
      'libs/public/ws-loading-wave/src/lib/a.shader.ts',
    ]);
  });

  void it('refuses a re-export it cannot map to a source file', () => {
    const root = entryFixture("export * from './lib/webgl/shaders';\n", []);

    assert.throws(() => shaderSources(root), BuildCheckError);
  });

  void it('refuses an entry without re-exports', () => {
    const root = entryFixture('export const nothing = 1;\n', []);

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

  void it('refuses to pass when a shader source is missing from the shaders bundle', () => {
    captureConsole();
    const dist = shellDist({ mainBundleSources: [] });

    assert.throws(
      () => checkLazyShaders(dist, [RIPPLE]),
      new BuildCheckError(
        `_wolsok_loading_wave_shaders-S.js and its imports hold none of ${RIPPLE} - the check would match nothing.`
      )
    );
  });

  void it('fails naming the shared chunk when both bundles share the shader code', () => {
    // a re-export from the main entry: esbuild moves the shader into a chunk both import
    const output = captureConsole();
    const dist = distFixture(
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
        'importmap.json': JSON.stringify({
          imports: { '@nf-internal/chunk-X': 'chunk-X.js' },
        }),
        'main-M.js': 'init().then(()=>import("./chunk-BOOT.js"));',
        'chunk-BOOT.js': 'import{L}from"@wolsok/loading-wave";',
        '_wolsok_loading_wave-W.js': 'import{s}from"@nf-internal/chunk-X";',
        '_wolsok_loading_wave_shaders-S.js':
          'import{s}from"@nf-internal/chunk-X";',
        'chunk-X.js': '',
      },
      { 'chunk-X.js': [`../../../${SHADER}`] }
    );

    assert.equal(checkLazyShaders(dist, [SHADER]), 1);
    assert.match(
      output.error.mock.calls[0].arguments[0],
      /chunk-X\.js: .*spark-front/
    );
  });

  void it('refuses to pass when the main loading-wave bundle is not loaded at start', () => {
    captureConsole();
    const dist = shellDist({ mainBundleSources: [], bootstrap: '' });

    assert.throws(() => checkLazyShaders(dist, [SHADER]), BuildCheckError);
  });
});
