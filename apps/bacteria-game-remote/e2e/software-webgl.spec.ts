import { expect, test } from '@playwright/test';
import { BacteriaGamePo } from './pos/bacteria-game.po';

// WebGL on SwiftShader, on the CPU, whatever GPU the machine has - a
// Chromium flag, so Chromium only.
test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'SwiftShader is forced with a Chromium flag'
);
test.use({ launchOptions: { args: ['--use-angle=swiftshader'] } });

test('should paint the arena with Canvas 2D where WebGL renders on the CPU', async ({
  page,
}) => {
  const po = new BacteriaGamePo(page);
  await po.goto();

  await expect(po.playArea).toHaveAttribute('data-renderer', 'canvas');
});

test('should keep WebGL there for a war the device override sends to the GPU', async ({
  page,
}) => {
  const po = new BacteriaGamePo(page);
  await po.goto('/?sim=gpu-int');

  await expect(po.playArea).toHaveAttribute('data-renderer', 'webgl');
});
