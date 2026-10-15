import { expect, test } from '@playwright/test';
import { BacteriaGamePo } from './pos/bacteria-game.po';

test('should display welcome message, game and controls', async ({ page }) => {
  const po = new BacteriaGamePo(page);
  await po.goto();

  await expect(po.mainTitle).toContainText('Bacteria War Game');
  await expect(po.playArea).toBeVisible();
  await expect(po.playCta).toBeVisible();
  await expect(po.resetCta).toBeVisible();
  await expect(po.fullscreenCta).toBeVisible();
});

test('should let the player pick another level', async ({ page }) => {
  const po = new BacteriaGamePo(page);
  await po.goto();

  await po.chooseLevel(/Serpentine/);

  await expect(po.levelSelect).toContainText('Serpentine');
  await expect(po.levelDescription).toContainText('winding path');
});

test('should start against the computer with one boost button', async ({
  page,
}) => {
  const po = new BacteriaGamePo(page);
  await po.goto();

  await expect(po.difficultySelect).toBeVisible();
  await expect(po.boostCta).toHaveCount(1);
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

test('should offer a boost per human in the two player mode', async ({
  page,
}) => {
  const po = new BacteriaGamePo(page);
  await po.goto();

  await po.chooseMode(/2 Players/);

  await expect(po.difficultySelect).toHaveCount(0);
  await expect(po.boostCta).toHaveCount(2);
  await expect(po.colonyNames).toContainText(['Orange', 'Blue']);
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

test('should keep the level picker out of a running match', async ({
  page,
}) => {
  const po = new BacteriaGamePo(page);
  await po.goto();

  await po.playCta.click();

  await expect(po.levelSelect).toHaveAttribute('aria-disabled', 'true');
});
