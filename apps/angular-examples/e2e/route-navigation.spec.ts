import { test, expect } from './fixtures/home-page.fixture';

test.describe('Route Navigation and Lazy Loading', () => {
  test('should navigate to home route by default', async ({ homePage, page }) => {
    // Given: User navigates to the app
    // (setup done by fixture - goes to /home)

    // When: Page has loaded
    await homePage.expectPageLoaded();

    // Then: URL should contain 'home'
    expect(page.url()).toContain('/home');
  });

  test('should navigate to tensorflow examples via side nav', async ({
    homePage,
    page,
  }) => {
    // Given: User opens the side navigation
    await homePage.openSideNav();
    await homePage.expectNavigationLinksVisible();

    // When: User clicks on tensorflow examples link
    await homePage.clickNavigationLink('Tensorflow');

    // Then: URL should change to tensorflow route
    await page.waitForURL(/tensorflowExamples/, { timeout: 10000 });
    expect(page.url()).toContain('tensorflowExamples');

    // And: Page should load lazy-loaded content
    // Wait for lazy module to load and render
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).toBeVisible();
  });

  test('should navigate to reaction diffusion route', async ({
    homePage,
    page,
  }) => {
    // Given: User opens the side navigation
    await homePage.openSideNav();
    await homePage.expectNavigationLinksVisible();

    // When: User clicks on reaction diffusion link
    await homePage.clickNavigationLink('Reaction Diffusion');

    // Then: URL should change to reactionDiff route
    await page.waitForURL(/reactionDiff/, { timeout: 10000 });
    expect(page.url()).toContain('reactionDiff');
  });

  test('should navigate to poisson distribution route', async ({
    homePage,
    page,
  }) => {
    // Given: User opens the side navigation
    await homePage.openSideNav();
    await homePage.expectNavigationLinksVisible();

    // When: User clicks on poisson link
    await homePage.clickNavigationLink('Poisson');

    // Then: URL should change to poisson route
    await page.waitForURL(/poisson/, { timeout: 10000 });
    expect(page.url()).toContain('poisson');
  });

  test('should handle back navigation correctly', async ({
    homePage,
    page,
  }) => {
    // Given: User is on home page
    await homePage.expectPageLoaded();
    const homeUrl = page.url();

    // When: User navigates to another route
    await homePage.openSideNav();
    await homePage.clickNavigationLink('Reaction Diffusion');
    await page.waitForURL(/reactionDiff/, { timeout: 10000 });

    // Then: URL should have changed
    const newUrl = page.url();
    expect(newUrl).not.toBe(homeUrl);

    // When: User goes back
    await page.goBack();

    // Then: Should return to home page
    await page.waitForURL(/home/, { timeout: 5000 });
    expect(page.url()).toContain('home');
  });

  test('should handle forward navigation correctly', async ({
    homePage,
    page,
  }) => {
    // Given: User has navigated forward and back
    await homePage.openSideNav();
    await homePage.clickNavigationLink('Reaction Diffusion');
    await page.waitForURL(/reactionDiff/, { timeout: 10000 });
    await page.goBack();
    await page.waitForURL(/home/, { timeout: 5000 });

    // When: User goes forward
    await page.goForward();

    // Then: Should return to reaction diffusion page
    await page.waitForURL(/reactionDiff/, { timeout: 5000 });
    expect(page.url()).toContain('reactionDiff');
  });

  test('should load multiple lazy routes without errors', async ({
    homePage,
    page,
  }) => {
    // Given: User is on home page
    await homePage.openSideNav();

    // When: User navigates through multiple routes
    const routes = [
      { text: 'Reaction Diffusion', url: 'reactionDiff' },
      { text: 'Poisson', url: 'poisson' },
    ];

    for (const route of routes) {
      // Navigate to route
      await homePage.openSideNav();
      await homePage.clickNavigationLink(route.text);
      await page.waitForURL(new RegExp(route.url), { timeout: 10000 });

      // Then: Route should load successfully
      expect(page.url()).toContain(route.url);
      
      // And: Page should not have console errors (checked via logs fixture)
      // Wait for content to load
      await page.waitForTimeout(1000);
    }
  });
});
