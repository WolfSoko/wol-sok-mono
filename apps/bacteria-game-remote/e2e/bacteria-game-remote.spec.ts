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

  constructor(page: Page) {
    this.page = page;
    this.mainTitle = page.locator('h1');
    this.playArea = page.locator('.canvas-container canvas');
    this.playCta = page.getByRole('button', { name: 'Start' });
    this.resetCta = page.getByRole('button', { name: 'Reset' });
    this.levelSelect = page.getByRole('combobox');
    this.levelDescription = page.locator('.level-description');
    this.fullscreenCta = page.getByRole('button', { name: /fullscreen/i });
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

test('should keep the level picker out of a running match', async ({
  page,
}) => {
  await page.goto('/');
  const po = new BacteriaGamePo(page);

  await po.playCta.click();

  await expect(po.levelSelect).toHaveAttribute('aria-disabled', 'true');
});
