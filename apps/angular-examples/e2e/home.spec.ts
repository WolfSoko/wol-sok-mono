import { test, expect } from '@playwright/test';
import { AngularExamplesPage } from './po/angular-examples.page';

test('has experiments title', async ({ page }) => {
  await page.goto('/');
  // Function helper example, see `../support/tensorflow-examples.po.ts` file
  const angularExamplesPage = new AngularExamplesPage(page);
  await expect(angularExamplesPage.experimentsTitle).toHaveCount(12);
});
