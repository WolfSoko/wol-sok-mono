import { expect, test } from '@playwright/test';
import { BacteriaGamePo } from './pos/bacteria-game.po';

test('should open on the main menu with the game and its controls', async ({
  page,
}) => {
  const po = new BacteriaGamePo(page);
  await po.goto();

  await expect(po.stage).toBeVisible();
  await expect(po.menuTitle).toHaveText('Bacteria War');
  await expect(po.playArea).toBeVisible();
  await expect(po.playCta).toBeVisible();
  await expect(po.profileCta).toBeVisible();
  await expect(po.settingsCta).toBeVisible();
  await expect(po.helpCta).toBeVisible();
  await expect(po.intro).toHaveCount(0);
});

test('should return to the page on request', async ({ page }) => {
  const po = new BacteriaGamePo(page);
  await po.goto();

  await po.leaveFullscreenCta.click();

  await expect(po.stage).toHaveCount(0);
  await expect(po.mainTitle).toContainText('Bacteria War Game');
  await expect(po.intro).toBeVisible();
  await expect(po.fullscreenCta).toBeVisible();

  await po.fullscreenCta.click();

  await expect(po.stage).toBeVisible();
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

  // Seat 0 is the left column, seat 1 the right one, each turned towards
  // its player: the stick sits in their left hand and the boost pad in their
  // right, so the pad is below the stick for the left player and above it
  // for the right one.
  const [leftStick, leftBoost, rightStick, rightBoost] = await Promise.all([
    po.boxOf(po.joystick(0)),
    po.boxOf(po.boostOf(0)),
    po.boxOf(po.joystick(1)),
    po.boxOf(po.boostOf(1)),
  ]);
  expect(leftStick.x).toBeLessThan(rightStick.x);
  expect(leftBoost.y).toBeGreaterThan(leftStick.y);
  expect(rightBoost.y).toBeLessThan(rightStick.y);
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
  await po.settingsCta.click();

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
  await po.goto();
  await expect(po.playArea).toHaveAttribute('data-simulation', 'gpu');

  await po.startMatch();
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
  await po.settingsCta.click();

  const green = page
    .getByRole('radiogroup', { name: 'Colour of You' })
    .getByRole('radio', { name: /^Green, locked/ });
  await expect(green).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('.locked-list')).toContainText(
    'Green - Earn First Blood'
  );
});
