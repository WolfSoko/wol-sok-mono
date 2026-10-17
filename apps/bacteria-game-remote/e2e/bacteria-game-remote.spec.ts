import { expect, test } from '@playwright/test';
import { BacteriaGamePo } from './pos/bacteria-game.po';

test('should fill the screen with the game and its controls', async ({
  page,
}) => {
  const po = new BacteriaGamePo(page);
  await po.goto();

  await expect(po.stage).toBeVisible();
  await expect(po.playArea).toBeVisible();
  await expect(po.playCta).toBeVisible();
  await expect(po.resetCta).toBeVisible();
  await expect(po.leaveFullscreenCta).toBeVisible();
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

test('should let the player pick another level', async ({ page }) => {
  const po = new BacteriaGamePo(page);
  await po.goto();

  await po.chooseLevel(/Serpentine/);

  await expect(po.levelSelect).toContainText('Serpentine');
  await expect(po.levelDescription).toContainText('winding path');
});

test('should start against the computer with one seat', async ({ page }) => {
  const po = new BacteriaGamePo(page);
  await po.goto();

  await expect(po.difficultySelect).toBeVisible();
  await expect(po.boostCta).toHaveCount(1);
  await expect(po.joysticks).toHaveCount(1);
  await expect(po.colonyNames).toContainText(['You', 'Computer']);
});

test('should let the player pick how hard the computer plays', async ({
  page,
}) => {
  const po = new BacteriaGamePo(page);
  await po.goto();

  await po.chooseDifficulty(/Hard/);

  await expect(po.difficultySelect).toContainText('Hard');
  await expect(po.difficultyDescription).toContainText('Reacts fast');
});

test('should seat two players at opposite edges', async ({ page }) => {
  const po = new BacteriaGamePo(page);
  await po.goto();

  await po.chooseMode(/2 Players/);

  await expect(po.difficultySelect).toHaveCount(0);
  await expect(po.boostCta).toHaveCount(2);
  await expect(po.joysticks).toHaveCount(2);
  await expect(po.colonyNames).toContainText(['Orange', 'Blue']);

  // The near seat sits below the far seat, its stick on the other side.
  const nearStick = await po.joystick(0).boundingBox();
  const farStick = await po.joystick(1).boundingBox();
  const nearBoost = await po.boostOf(0).boundingBox();
  expect(nearStick?.y).toBeGreaterThan(farStick?.y ?? Infinity);
  expect(nearStick?.x).toBeLessThan(farStick?.x ?? -Infinity);
  expect(nearBoost?.x).toBeGreaterThan(nearStick?.x ?? Infinity);
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

  await expect(po.joystick(0)).toHaveClass(/active/);
  await po.release();
  await expect(po.joystick(0)).not.toHaveClass(/active/);
});

test('should keep the match setup out of a running match', async ({ page }) => {
  const po = new BacteriaGamePo(page);
  await po.goto();

  await po.playCta.click();

  await expect(po.levelSelect).toHaveCount(0);
  await expect(po.playCta).toHaveCount(0);

  await po.resetCta.click();

  // The reset first vaporizes the arena, which takes a few seconds.
  await expect(po.levelSelect).toBeVisible({ timeout: 30_000 });
});
