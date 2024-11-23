import { expect, Page } from '@playwright/test';

export class HomePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/');
  }

  async expectTitleVisible() {
    await expect(
      this.page.getByRole('heading', {
        name: 'Pace-Trainer',
      })
    ).toBeVisible();
    await expect(
      this.page.getByText('Dein digitaler Laufcoach.')
    ).toBeVisible();
  }
}
