import { test } from '@playwright/test';
import { HomePage } from './pos/home.page';

test.describe('Home', () => {
  let homePage: HomePage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    await homePage.goto();
  });

  test('has title', async () => {
    await homePage.expectTitleVisible();
  });

  test('informs about coming soon', async () => {
    await homePage.expectComingSoonVisible();
  });

  test('has a cta to follow on twitter', async () => {
    await homePage.expectTwitterLinkVisible();
  });
});
