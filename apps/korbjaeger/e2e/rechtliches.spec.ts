import { SITE_OWNER } from '@wolsok/shared-legal';
import { expect, test } from './fixtures/pages.fixture';

test.describe('The legal pages', () => {
  test('are linked from the footer, with the DBB named as the source', async ({
    page,
  }) => {
    await page.goto('/');
    const fusszeile = page.getByRole('contentinfo');
    await expect(fusszeile).toContainText('Deutschen Basketball Bund');

    await fusszeile.getByRole('link', { name: 'Datenschutz' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Datenschutzerklärung' })
    ).toBeVisible();

    await fusszeile.getByRole('link', { name: 'Impressum' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Impressum' })
    ).toBeVisible();
  });

  for (const pfad of ['/privacy', '/impressum']) {
    test(`${pfad} opens directly and is noindex`, async ({ page }) => {
      await page.goto(pfad);

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
