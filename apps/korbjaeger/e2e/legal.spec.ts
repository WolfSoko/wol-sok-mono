import { SITE_OWNER } from '@wolsok/shared-legal';
import { expect, test } from './fixtures/pages.fixture';

test.describe('The legal pages', () => {
  test('are linked from the footer, with the DBB named as the source', async ({
    page,
  }) => {
    await page.goto('/');
    const footer = page.getByRole('contentinfo');
    await expect(footer).toContainText('Deutschen Basketball Bund');

    await footer.getByRole('link', { name: 'Datenschutz' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Datenschutzerklärung' })
    ).toBeVisible();

    // the footer sits below the long policy: the next page opens at its top
    await footer.getByRole('link', { name: 'Impressum' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Impressum' })
    ).toBeInViewport();
  });

  for (const path of ['/privacy', '/impressum']) {
    test(`${path} opens directly and is noindex`, async ({ page }) => {
      await page.goto(path);

      await expect(page.locator('address').first()).toContainText(
        SITE_OWNER.name
      );
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        'content',
        'noindex'
      );
    });
  }
});
