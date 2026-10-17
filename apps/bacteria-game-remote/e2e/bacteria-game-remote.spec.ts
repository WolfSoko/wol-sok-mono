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

test('should let the player pick another level in the settings', async ({
  page,
}) => {
  const po = new BacteriaGamePo(page);
  await po.goto();
  await po.settingsCta.click();

  await po.chooseLevel(/Serpentine/);

  await expect(po.levelSelect).toContainText('Serpentine');
  await expect(po.levelDescription).toContainText('winding path');

  await po.backCta.click();

  await expect(po.playCta).toBeVisible();
  await expect(page.locator('.menu-summary')).toContainText('Serpentine');
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

  await expect(page.locator('.help')).toContainText('joystick');
  await po.backCta.click();
  await expect(po.playCta).toBeVisible();
});

test('should start against the computer with one seat', async ({ page }) => {
  const po = new BacteriaGamePo(page);
  await po.goto();

  await expect(po.boostCta).toHaveCount(1);
  await expect(po.joysticks).toHaveCount(1);
  await expect(po.colonyNames).toContainText(['You', 'Computer']);
});

test('should let the player pick how hard the computer plays', async ({
  page,
}) => {
  const po = new BacteriaGamePo(page);
  await po.goto();
  await po.settingsCta.click();

  await po.chooseDifficulty(/Hard/);

  await expect(po.difficultySelect).toContainText('Hard');
  await expect(po.difficultyDescription).toContainText('Reacts fast');
});

test('should seat two players at opposite edges', async ({ page }) => {
  const po = new BacteriaGamePo(page);
  await po.goto();

  await po.chooseMode(/2 Players/);

  await expect(po.boostCta).toHaveCount(2);
  await expect(po.joysticks).toHaveCount(2);
  await expect(po.colonyNames).toContainText(['Orange', 'Blue']);

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

  await po.playCta.click();

  await expect(po.boostCta).toBeEnabled();
  await po.boostCta.click();
  await expect(po.boostCta).toBeDisabled();
  await expect(po.boostCta).toContainText('Boosting');
});

test('should fire the boost with the keyboard', async ({ page }) => {
  const po = new BacteriaGamePo(page);
  await po.goto();
  await po.playCta.click();
  await expect(po.boostCta).toBeEnabled();

  await po.pressBoostKey('Space');

  await expect(po.boostCta).toContainText('Boosting');
});

test('should show the stick under the finger while it is pushed', async ({
  page,
}) => {
  const po = new BacteriaGamePo(page);
  await po.goto();
  await po.playCta.click();
  await expect(po.boostCta).toBeEnabled();

  await po.push(0, 30, 0);

  await expect(po.heldStick(0)).toBeVisible();
  await po.release();
  await expect(po.heldStick(0)).toHaveCount(0);
});

test('should pause into a menu and quit back to the main menu', async ({
  page,
}) => {
  const po = new BacteriaGamePo(page);
  await po.goto();

  await po.playCta.click();

  await expect(po.playCta).toHaveCount(0);
  await expect(po.menuTitle).toHaveCount(0);

  await po.pauseCta.click();

  await expect(po.resumeCta).toBeVisible();
  await expect(po.quitCta).toBeVisible();

  await po.quitCta.click();

  // The arena is vaporized first, which takes a few seconds.
  await expect(po.playCta).toBeVisible({ timeout: 30_000 });
});
