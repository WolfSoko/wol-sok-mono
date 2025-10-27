import { test, expect } from './fixtures/home-page.fixture';

test.describe('Navigation Menu Functionality', () => {
  test('should toggle side navigation on menu button click', async ({
    homePage,
  }) => {
    // Given: User is on the home page with side nav closed
    await homePage.expectSideNavClosed();

    // When: User clicks the menu button to open side nav
    await homePage.openSideNav();

    // Then: Side navigation should be open
    await homePage.expectSideNavOpen();
    await homePage.expectNavigationLinksVisible();

    // When: User clicks the menu button again to close
    await homePage.closeSideNav();

    // Then: Side navigation should be closed
    await homePage.expectSideNavClosed();
  });

  test('should display all navigation links in side nav', async ({
    homePage,
  }) => {
    // Given: User opens the side navigation
    await homePage.openSideNav();

    // When: Side nav is visible
    await homePage.expectNavigationLinksVisible();

    // Then: Should display multiple navigation links
    const linkCount = await homePage.getNavigationLinkCount();
    expect(linkCount).toBeGreaterThan(5); // App has multiple routes
  });

  test('should navigate to correct route when clicking a link', async ({
    homePage,
    page,
  }) => {
    // Given: User opens the side navigation
    await homePage.openSideNav();
    await homePage.expectNavigationLinksVisible();

    // When: User clicks on a navigation link (e.g., "TensorFlow examples")
    const initialUrl = page.url();
    await homePage.clickNavigationLink('Tensorflow');

    // Then: URL should change to the new route
    await page.waitForURL(/tensorflowExamples/, { timeout: 10000 });
    const newUrl = page.url();
    expect(newUrl).not.toBe(initialUrl);
    expect(newUrl).toContain('tensorflowExamples');
  });
});
