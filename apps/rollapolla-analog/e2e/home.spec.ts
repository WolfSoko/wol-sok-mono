import { test } from './fixture/home-page-hydrated.fixture';

test.describe('Home', () => {
  test('has title', async ({ homePage }) => {
    await homePage.expectTitleVisible();
  });

  test('explains what to do', async ({ homePage }) => {
    await homePage.expectIntroDescriptionVisible();
  });

  test('has a cta to follow X', async ({ homePage }) => {
    await homePage.expectXLinkVisible();
  });
});
