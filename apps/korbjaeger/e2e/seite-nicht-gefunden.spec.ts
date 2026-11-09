import { expect, test } from './fixtures/pages.fixture';

test.describe('An unknown page', () => {
  test('says it does not exist, marked noindex, and leads home', async ({
    page,
    startPage,
  }) => {
    await page.goto('/gibtsnicht');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Seite nicht gefunden' })
    ).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex'
    );

    await page.getByRole('link', { name: 'Zur Startseite' }).click();
    await expect(startPage.leer).toBeVisible();
  });
});
