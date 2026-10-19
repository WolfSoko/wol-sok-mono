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
    await expect(
      share.getByRole('heading', { name: 'Share RollaPolla' })
    ).toBeVisible();
    await expect(share.getByTestId('copy-link')).toBeVisible();
    // Hydrated on viewport: the server builds the links on the site's origin,
    // the browser on its own once the box scrolled into view.
    await share.scrollIntoViewIfNeeded();
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
