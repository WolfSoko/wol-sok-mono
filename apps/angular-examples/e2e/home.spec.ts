import { expect, test } from './fixtures/page-diagnostics';
import { AngularExamplesPage } from './po/angular-examples.page';

test('has main title', async ({ page }) => {
  await page.goto('/');
  // Function helper example, see `../support/tensorflow-examples.po.ts` file
  const angularExamplesPage = new AngularExamplesPage(page);
  await expect(angularExamplesPage.mainTitle).toContainText('WolSok');
  await expect(angularExamplesPage.mainTitle).toContainText('Experiments');
});
