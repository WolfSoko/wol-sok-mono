import { expect, test as testBase } from '../fixture/logs.fixture';
import { HomePage } from '../pos/home.page';

const test = testBase.extend<{ homePage: HomePage }>({
  homePage: async ({ page, logs }, use) => {
    const homePage = new HomePage(page);
    await homePage.goto();
    await expect(logs).toHaveConsoleMsg('Angular hydrated');
    await homePage.expectTitleVisible();
    await use(homePage);
  },
});

export { expect, test };
