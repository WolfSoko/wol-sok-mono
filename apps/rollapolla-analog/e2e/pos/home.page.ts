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
    await expect(this.page.getByTestId('home-link')).toContainText(
      'RollaPolla'
    );
    await expect(
      this.page.getByRole('heading', {
        level: 1,
        name: 'Easy Polling for Everyone!',
      })
    ).toBeVisible();
  }

  async expectIntroDescriptionVisible() {
    await expect(this.page.getByTestId('intro-description')).toContainText(
      'Create a poll'
    );
  }

  async expectXLinkVisible() {
    const twitterLink = this.page.getByRole('link', {
      name: 'Follow RollaPolla on X',
    });
    await expect(twitterLink).toBeVisible();
    expect(await twitterLink.getAttribute('href')).toContain(
      'https://x.com/rollapolla'
    );
    await expect(twitterLink).toHaveAttribute('target', '_blank');
    // Structure, not pixels: a screenshot baseline differs per OS, browser
    // build and font rasterizer, so it can't be authored outside CI.
    await expect(twitterLink).toMatchAriaSnapshot(`
      - link "Follow RollaPolla on X":
        - /url: https://x.com/rollapolla
    `);
  }
}
