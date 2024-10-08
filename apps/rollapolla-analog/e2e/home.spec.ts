import { test } from './fixture/home-page-hydrated.fixture';

test.describe('Home', () => {
  test('has title', async ({ homePage }) => {
    await homePage.expectTitleVisible();
  });

  test('informs about coming soon', async ({ homePage }) => {
    await homePage.expectComingSoonVisible();
  });

  test('has a cta to follow on twitter', async ({ homePage }) => {
    await homePage.expectTwitterLinkVisible();
  });
});
