import { expect, test } from '@playwright/test';
import { BacteriaGamePo } from './pos/bacteria-game.po';

test('should open on the main menu with the game and its controls', async ({
  page,
}) => {
  const po = new BacteriaGamePo(page);
  await po.goto();

  await expect(po.stage).toBeVisible();
  await expect(po.menuTitle).toHaveText('Bacteria Wars');
  await expect(po.playArea).toBeVisible();
  await expect(po.playCta).toBeVisible();
  await expect(po.profileCta).toBeVisible();
  await expect(po.settingsCta).toBeVisible();
  await expect(po.helpCta).toBeVisible();
});

test('should look the same in the page and fullscreen', async ({ page }) => {
  const po = new BacteriaGamePo(page);
  await po.goto();
  // A desktop opens the stage in the page, filling the viewport.
  await expect(po.fullscreenStage).toHaveCount(0);
  const embedded = await po.boxOf(po.stage);
  expect(embedded.height).toBeGreaterThan(400);

  await po.fullscreenCta.click();

  await expect(po.fullscreenStage).toBeVisible();
  await expect(po.menuTitle).toHaveText('Bacteria Wars');
  await expect(po.playCta).toBeVisible();

  await po.exitFullscreenCta.click();

  await expect(po.fullscreenStage).toHaveCount(0);
  await expect(po.menuTitle).toHaveText('Bacteria Wars');
  await expect(po.fullscreenCta).toBeVisible();
});

test('should let the player pick a level when starting a match', async ({
  page,
}) => {
  const po = new BacteriaGamePo(page);
  await po.goto();
  await po.playCta.click();
  // In the campaign the levels open one by one; free play opens them all.
  await po.chooseMode('Free play');

  await po.chooseLevel('Serpentine');

  await expect(po.startStep).toContainText('Serpentine');
  await expect(po.startStep).toContainText('winding path');
  await expect(po.startCta).toHaveText(/Start Serpentine/);

  await po.stepBackCta.click();
  await po.stepBackCta.click();
  await po.backCta.click();
  await expect(po.playCta).toBeVisible();
});

test('should lock the levels the campaign has not opened yet', async ({
  page,
}) => {
  const po = new BacteriaGamePo(page);
  await po.goto();

  await po.playCta.click();
  await po.chooseMode('Campaign');

  await expect(po.levelCard('Corridors')).toBeDisabled();
  await expect(po.levelCard('Corridors')).toContainText(
    'Win Petri Dish to unlock'
  );
  await expect(po.levelCard('Petri Dish')).toBeEnabled();
});

test('should mute the game and remember it on the next visit', async ({
  page,
}) => {
  const po = new BacteriaGamePo(page);
  await po.goto();

  await po.muteCta.click();

  await expect(po.unmuteCta).toBeVisible();
  await page.reload();
  await expect(po.unmuteCta).toBeVisible();

  await po.unmuteCta.click();

  await expect(po.muteCta).toBeVisible();
});

test('should explain the game', async ({ page }) => {
  const po = new BacteriaGamePo(page);
  await po.goto();

  await po.helpCta.click();

  await expect(page.locator('feat-lazy-bac-game-help')).toContainText(
    'joystick'
  );
  await po.backCta.click();
  await expect(po.playCta).toBeVisible();
});

test('should start against the computer with one seat', async ({ page }) => {
  const po = new BacteriaGamePo(page);
  await po.goto();

  await po.startMatch();

  await expect(po.boostCta).toHaveCount(1);
  await expect(po.joysticks).toHaveCount(1);
  await expect(po.colonyNames).toContainText(['You', 'Computer']);
});

test('should let the player pick how hard the computer plays', async ({
  page,
}) => {
  const po = new BacteriaGamePo(page);
  await po.goto();
  await po.setUp();

  await po.chooseDifficulty(/Hard/);

  await expect(
    po.difficultyPicker.getByRole('radio', { name: 'Hard' })
  ).toBeChecked();
  await expect(po.startStep).toContainText('Reacts fast');
});

test('should seat two players at opposite edges', async ({ page }) => {
  const po = new BacteriaGamePo(page);
  await po.goto();

  await po.playCta.click();
  await po.chooseMode('Two players');

  await expect(po.boostCta).toHaveCount(2);
  await expect(po.joysticks).toHaveCount(2);

  // Each player's controls lie over the arena at their end of the screen,
  // turned towards them: seat 0 at the left edge (the bottom one on an
  // upright screen), seat 1 at the opposite one. The boost pad sits in the
  // corner under the player's right hand, so the two pads are in opposite
  // corners.
  const [stage, leftStick, leftBoost, rightStick, rightBoost] =
    await Promise.all([
      po.boxOf(po.stage),
      po.boxOf(po.joystick(0)),
      po.boxOf(po.boostOf(0)),
      po.boxOf(po.joystick(1)),
      po.boxOf(po.boostOf(1)),
    ]);
  // The stylesheet seats by the viewport's orientation, not the stage's.
  const viewport = page.viewportSize();
  if (viewport == null || viewport.width > viewport.height) {
    expect(po.centreOf(leftStick).x).toBeLessThan(po.centreOf(rightStick).x);
    expect(po.centreOf(leftBoost).x).toBeLessThan(po.centreOf(rightBoost).x);
    expect(leftBoost.y).toBeGreaterThan(rightBoost.y);
  } else {
    expect(po.centreOf(leftStick).y).toBeGreaterThan(po.centreOf(rightStick).y);
    expect(po.centreOf(leftBoost).y).toBeGreaterThan(po.centreOf(rightBoost).y);
    expect(leftBoost.x).toBeGreaterThan(rightBoost.x);
  }
  // The arena takes the whole stage, under the controls.
  const arena = await po.boxOf(po.playArea);
  expect(
    Math.max(arena.width / stage.width, arena.height / stage.height)
  ).toBeGreaterThan(0.95);
});

test('should arm the boost once the match runs', async ({ page }) => {
  const po = new BacteriaGamePo(page);
  await po.goto();
  await expect(po.boostCta).toBeDisabled();

  await po.startMatch();

  await expect(po.boostCta).toBeEnabled();
  await po.boostCta.click();
  await expect(po.boostCta).toBeDisabled();
  await expect(po.boostCta).toContainText('Boosting');
});

test('should fire the boost with the keyboard', async ({ page }) => {
  const po = new BacteriaGamePo(page);
  await po.goto();
  await po.startMatch();
  await expect(po.boostCta).toBeEnabled();

  await po.pressBoostKey('Space');

  await expect(po.boostCta).toContainText('Boosting');
});

test('should show the stick under the finger while it is pushed', async ({
  page,
}) => {
  const po = new BacteriaGamePo(page);
  await po.goto();
  await po.startMatch();
  await expect(po.boostCta).toBeEnabled();

  await po.push(0, 30, 0);

  await expect(po.heldStick(0)).toBeVisible();
  await po.release();
  await expect(po.heldStick(0)).toHaveCount(0);
});

test.describe('on a touchscreen', () => {
  test.use({ hasTouch: true });

  test('should fire the boost while the other finger holds the joystick', async ({
    page,
    browserName,
  }) => {
    // Real multi-touch needs the Chrome DevTools protocol.
    test.skip(browserName !== 'chromium', 'multi-touch is Chromium only');
    const po = new BacteriaGamePo(page);
    await po.goto();
    await po.startMatch();
    await expect(po.boostCta).toBeEnabled();

    await po.tapBoostWhileHoldingStick(0);

    await expect(po.boostCta).toContainText('Boosting');
  });
});

test('should let the players pick their colours', async ({ page }) => {
  const po = new BacteriaGamePo(page);
  // A player who earned green (First Blood) and pink (the rank Bacillus).
  await page.addInitScript(() =>
    localStorage.setItem(
      'bacteria-game.progress',
      JSON.stringify({
        totals: { matchXp: 1000 },
        achievements: { 'first-blood': '2026-10-19' },
      })
    )
  );
  await po.goto();
  await po.playCta.click();
  await po.chooseMode('Two players');
  await po.stepBackCta.click();
  await po.backCta.click();
  await po.colonyCta.click();

  await po.chooseColor('Left player', 'Green');
  await po.chooseColor('Right player', 'Pink');
  await po.backCta.click();
  await po.setUp('Two players');
  await po.startCta.click();

  await expect(po.colonyNames).toContainText(['Green', 'Pink']);
});

test('should draw the arena on the GPU and keep it readable', async ({
  page,
  browserName,
}) => {
  const po = new BacteriaGamePo(page);
  await po.goto();
  if (browserName === 'chromium') {
    await expect(po.playArea).toHaveAttribute('data-renderer', 'webgl');
  }

  await po.startMatch();

  // Read the arena back off the canvas, as the vaporize effect does. The
  // orange colony starts a quarter across and halfway down the 320x180 arena.
  await expect
    .poll(() => po.arenaPixel(80, 90))
    .toEqual(expect.objectContaining({ orange: true }));
});

test('should run the colony war on the GPU', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'WebGL2 is checked in Chromium');
  const po = new BacteriaGamePo(page);
  // CI has SwiftShader only, a software renderer the game keeps on the CPU
  // (ADR 0015): the device override sends local matches to the integer GPU
  // passes all the same. They pass the self-test there too.
  await po.goto('/?sim=gpu-int');
  await expect(po.playArea).toHaveAttribute('data-gpu-self-test', 'passed');

  await po.startMatch();
  await expect(po.playArea).toHaveAttribute('data-simulation', 'gpu');
  const start = await po.colonyCount(0);

  // The colonies divide - the GPU steps the war and the numbers come back.
  await expect.poll(() => po.colonyCount(0)).toBeGreaterThan(start);
  // ...and nobody won on numbers that were not in yet.
  await expect(po.winner).toHaveCount(0);
});

test('should pause into a menu and quit back to the main menu', async ({
  page,
}) => {
  const po = new BacteriaGamePo(page);
  await po.goto();

  await po.startMatch();

  await expect(po.playCta).toHaveCount(0);
  await expect(po.menuTitle).toHaveCount(0);

  await po.pauseCta.click();

  await expect(po.resumeCta).toBeVisible();
  await expect(po.quitCta).toBeVisible();

  await po.quitCta.click();

  // The arena is vaporized first, which takes a few seconds.
  await expect(po.playCta).toBeVisible({ timeout: 30_000 });
});

test('should keep the colours still to earn locked, saying what opens them', async ({
  page,
}) => {
  const po = new BacteriaGamePo(page);
  await po.goto();
  await po.colonyCta.click();

  const green = page
    .getByRole('radiogroup', { name: 'Colour of You' })
    .getByRole('radio', { name: /^Green, locked/ });
  await expect(green).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('.locked-list')).toContainText(
    'Green - Earn First Blood'
  );
});

test('should show the privacy policy on a page of its own', async ({
  page,
}) => {
  await page.goto('/privacy#en-delete');

  await expect(page).toHaveTitle('Datenschutz - Bacteria Wars');
  await expect(
    page.getByRole('heading', { name: 'Datenschutzerklärung' })
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '11. Deleting your account and data' })
  ).toBeInViewport();
  await expect(page.locator('#bacteria-game-splash')).toHaveCount(0);

  await page.getByRole('link', { name: /Back to the game/ }).click();

  // The click lets the game ask for native fullscreen, which WebKit may
  // refuse and so leave the game in the page: the arena is there either way.
  // The game's chunk, Firebase included, loads only now, while the service
  // worker the policy page registered prefetches the app.
  await expect(new BacteriaGamePo(page).playArea).toBeVisible({
    timeout: 15_000,
  });
});

test('should show the legal notice on a page of its own, reached from the menu', async ({
  page,
}) => {
  const po = new BacteriaGamePo(page);
  await po.goto();

  await page
    .locator('footer')
    .getByRole('link', { name: 'Legal notice' })
    .click();

  await expect(page).toHaveTitle('Impressum - Bacteria Wars');
  await expect(page.getByRole('heading', { name: 'Impressum' })).toBeVisible();
  await expect(page.locator('address').first()).toContainText(
    'Wolfram Sokollek'
  );
  await expect(page.locator('#bacteria-game-splash')).toHaveCount(0);

  await page.getByRole('link', { name: 'English' }).click();
  await expect(
    page.getByRole('heading', { name: 'Legal notice' })
  ).toBeInViewport();

  await page.getByRole('link', { name: /Back to the game/ }).click();
  await expect(po.playArea).toBeVisible({ timeout: 15_000 });
});
