import { test, expect, Locator, Page } from '@playwright/test';

class BacteriaGamePo {
  private page: Page;
  mainTitle: Locator;
  playArea: Locator;
  playCta: Locator;
  resetCta: Locator;

  constructor(page: Page) {
    this.page = page;
    this.mainTitle = page.locator('h1');
    this.playArea = page.locator('.canvas-container canvas');
    this.playCta = page.getByRole('button', { name: 'Start' });
    this.resetCta = page.getByRole('button', { name: 'Reset' });
  }
}
test('should display welcome message, game and controls', async ({ page }) => {
  await page.goto('/');
  const po = new BacteriaGamePo(page);

  await expect(po.mainTitle).toContainText('Bacteria War Game');
  await expect(po.playArea).toBeVisible();
  await expect(po.playCta).toBeVisible();
  await expect(po.resetCta).toBeVisible();
});
