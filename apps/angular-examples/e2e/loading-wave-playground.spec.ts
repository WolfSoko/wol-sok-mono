import { expect, test } from './fixtures/page-diagnostics';
import { LoadingWavePlaygroundPage } from './po/loading-wave-playground.page';

/** fails to compile, so the shader stage falls back to the 2D canvas */
const BROKEN_FRAGMENT = 'vec4 wsShade(vec2 point) { nope }';

/** every built-in shader, by its label in the playground's picker */
const BUILT_IN_SHADERS = [
  'Ripple',
  'Circuit traces',
  'Data bus',
  'Die scan',
  'Signal trace',
  'Spark front',
];

/** the waves of the small elements card: three buttons, a chip, three spinners */
const SMALL_WAVES = 7;

// CI has no GPU: Chromium draws WebGL2 on SwiftShader, which it offers only when asked
test.use({
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
});

test.describe('loading wave playground', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'the shaders are checked on SwiftShader, which only Chromium brings'
  );

  for (const label of BUILT_IN_SHADERS) {
    test(`draws the ${label} shader with WebGL`, async ({ page }) => {
      const playground = new LoadingWavePlaygroundPage(page);
      await playground.open();
      // start on the canvas, so only the picked shader's own program says "webgl"
      await playground.applyCustomFragment(BROKEN_FRAGMENT);
      await expect(playground.gpuRenderer).toHaveText('drawn by: canvas');

      await playground.pickShader(label);

      await expect(playground.gpuRenderer).toHaveText('drawn by: webgl');
    });
  }

  test('lays a wave on every small element while loading', async ({ page }) => {
    const playground = new LoadingWavePlaygroundPage(page);
    await playground.open();

    await expect(playground.smallElements.locator('canvas')).toHaveCount(
      SMALL_WAVES
    );
  });

  test('falls back to the 2D canvas for a fragment that does not compile', async ({
    page,
  }) => {
    const playground = new LoadingWavePlaygroundPage(page);
    await playground.open();

    await expect(playground.gpuRenderer).toHaveText('drawn by: webgl');

    await playground.applyCustomFragment(BROKEN_FRAGMENT);

    await expect(playground.gpuRenderer).toHaveText('drawn by: canvas');
  });
});
