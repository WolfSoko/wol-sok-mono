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
    // The tagline is hidden below Angular Material's xs breakpoint (599px)
    // to prevent horizontal overflow on mobile viewports.
    const viewportWidth = this.page.viewportSize()?.width ?? Infinity;
    if (viewportWidth > 599) {
      await expect(
        this.page.getByText('Dein digitaler Laufcoach.')
      ).toBeVisible();
    }
  }
}
