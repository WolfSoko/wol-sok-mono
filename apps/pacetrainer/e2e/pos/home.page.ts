import { expect, Page } from '@playwright/test';

export class HomePage {
  readonly page: Page;

  readonly sprintTraining;

  constructor(page: Page) {
    this.page = page;
    this.sprintTraining = page.getByTestId('sprint-training');
  }

  async goto() {
    await this.page.goto('/');
  }

  async expectTitleVisible() {
    // check html title
    expect(await this.page.title()).toBe('Pace-Trainer');
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
