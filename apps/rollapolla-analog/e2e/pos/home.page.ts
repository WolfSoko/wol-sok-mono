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

  async expectShareLinksVisible() {
    const share = this.page.getByTestId('site-share');
    await expect(share.getByText('Share RollaPolla')).toBeVisible();
    await expect(share.getByTestId('copy-link')).toBeVisible();
    // Hydrated on viewport: the server builds the links on the site's origin,
    // the browser on its own once it has hydrated the box.
    const homeUrl = new URL('/', this.page.url()).href;
    const whatsApp = share.getByTestId('share-whatsapp');
    await expect(whatsApp).toHaveAttribute(
      'href',
      /^https:\/\/wa\.me\/\?text=/
    );
    // The link ends the message, and it is the home page, no deeper page.
    await expect
      .poll(async () => {
        const href = (await whatsApp.getAttribute('href')) ?? '';
        return new URL(href).searchParams.get('text')?.split('\n').at(-1);
      })
      .toBe(homeUrl);
  }
}
