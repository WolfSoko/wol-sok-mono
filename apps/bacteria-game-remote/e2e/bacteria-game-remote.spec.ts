import { test, expect, Locator, Page } from '@playwright/test';

class BacteriaGamePo {
  private page: Page;
  mainTitle: Locator;
  playArea: Locator;
  playCta: Locator;
  resetCta: Locator;
  levelSelect: Locator;
  levelDescription: Locator;
  fullscreenCta: Locator;
  modePicker: Locator;
  difficultySelect: Locator;
  boostCta: Locator;

  constructor(page: Page) {
    this.page = page;
    this.mainTitle = page.locator('h1');
    this.playArea = page.locator('.canvas-container canvas');
    this.playCta = page.getByRole('button', { name: 'Start' });
    this.resetCta = page.getByRole('button', { name: 'Reset' });
    this.levelSelect = page.locator('.level-select');
    this.levelDescription = page.locator('.level-description');
    this.fullscreenCta = page.getByRole('button', { name: /fullscreen/i });
    this.modePicker = page.locator('.mode-picker');
    this.difficultySelect = page.locator('.difficulty-select');
    this.boostCta = page.getByRole('button', { name: /^Boost/ });
  }

  async chooseMode(name: RegExp) {
    await this.modePicker.getByRole('radio', { name }).click();
  }

  async chooseLevel(name: RegExp) {
    await this.levelSelect.click();
    await this.page.getByRole('option', { name }).click();
  }
}

test('should display welcome message, game and controls', async ({ page }) => {
  await page.goto('/');
  const po = new BacteriaGamePo(page);

  await expect(po.mainTitle).toContainText('Bacteria War Game');
  await expect(po.playArea).toBeVisible();
  await expect(po.playCta).toBeVisible();
  await expect(po.resetCta).toBeVisible();
  await expect(po.fullscreenCta).toBeVisible();
});

test('should let the player pick another level', async ({ page }) => {
  await page.goto('/');
  const po = new BacteriaGamePo(page);

  await po.chooseLevel(/Serpentine/);

  await expect(po.levelSelect).toContainText('Serpentine');
  await expect(po.levelDescription).toContainText('winding path');
});

test('should start against the computer with one boost button', async ({
  page,
}) => {
  await page.goto('/');
  const po = new BacteriaGamePo(page);

  await expect(po.difficultySelect).toBeVisible();
  await expect(po.boostCta).toHaveCount(1);
  await expect(page.locator('.colony-name')).toContainText(['You', 'Computer']);
});

test('should offer a boost per human in the two player mode', async ({
  page,
}) => {
  await page.goto('/');
  const po = new BacteriaGamePo(page);

  await po.chooseMode(/2 Players/);

  await expect(po.difficultySelect).toHaveCount(0);
  await expect(po.boostCta).toHaveCount(2);
  await expect(page.locator('.colony-name')).toContainText(['Orange', 'Blue']);
});

test('should arm the boost once the match runs', async ({ page }) => {
  await page.goto('/');
  const po = new BacteriaGamePo(page);
  await expect(po.boostCta).toBeDisabled();

  await po.playCta.click();

  await expect(po.boostCta).toBeEnabled();
  await po.boostCta.click();
  await expect(po.boostCta).toBeDisabled();
});

test('should keep the level picker out of a running match', async ({
  page,
}) => {
  await page.goto('/');
  const po = new BacteriaGamePo(page);

  await po.playCta.click();

  await expect(po.levelSelect).toHaveAttribute('aria-disabled', 'true');
});
