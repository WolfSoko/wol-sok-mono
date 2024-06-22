import { expect, Locator, Page } from '@playwright/test';

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
        name: 'RollaPolla',
      })
    ).toBeVisible();
    await expect(
      this.page.getByText('Easy Polling for Everyone!')
    ).toBeVisible();
  }

  async expectComingSoonVisible() {
    await expect(this.page.getByTestId('coming-soon')).toContainText(
      'Coming Soon!'
    );
  }

  async expectTwitterLinkVisible() {
    const twitterLink: Locator = this.page.getByRole('link', {
      name: 'Follow along on Twitter',
    });
    await expect(twitterLink).toBeVisible();
    expect(await twitterLink.getAttribute('href')).toContain(
      'https://twitter.com/rollapolla'
    );
    await expect(twitterLink).toHaveAttribute('target', '_blank');
  }
}
