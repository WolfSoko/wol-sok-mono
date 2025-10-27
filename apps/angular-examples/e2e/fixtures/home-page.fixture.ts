import { test as testBase, expect } from './logs.fixture';
import { HomePage } from '../po/home.page';

const test = testBase.extend<{ homePage: HomePage }>({
  homePage: async ({ page }, use) => {
    const homePage = new HomePage(page);
    await homePage.goto();
    await homePage.expectPageLoaded();
    await use(homePage);
  },
});

export { expect, test };
