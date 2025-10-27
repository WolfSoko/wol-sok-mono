import { test, expect } from './fixtures/home-page.fixture';

test.describe('Home Page with Technologies Display', () => {
  test('should display main title with WolSok and Experiments', async ({
    homePage,
  }) => {
    // Given: User is on the home page
    // (setup done by fixture)

    // When: Page has loaded
    await homePage.expectPageLoaded();

    // Then: Main title should be visible with correct text
    await homePage.expectTitleVisible();
  });

  test('should display all 9 technology cards', async ({ homePage }) => {
    // Given: User is on the home page
    await homePage.expectPageLoaded();

    // When: Technology cards are loaded
    await homePage.expectTechnologyCardsVisible();

    // Then: Should display exactly 9 technology cards
    const cardCount = await homePage.getTechnologyCardCount();
    expect(cardCount).toBe(9); // Angular+, Nx, TypeScript, p5js, three.js, gpu.js, Material, TensorFlow, Firebase
  });

  test('should display technology card information', async ({
    homePage,
    page,
  }) => {
    // Given: User is on the home page with technology cards visible
    await homePage.expectTechnologyCardsVisible();

    // When: Checking technology card content
    const firstCard = page.locator('app-technology').first();

    // Then: Card should have an image and title
    await expect(firstCard.locator('img')).toBeVisible();
    await expect(firstCard.locator('mat-card-title')).toBeVisible();
  });

  test('should have clickable technology cards with links', async ({
    homePage,
    page,
  }) => {
    // Given: User is on the home page with technology cards visible
    await homePage.expectTechnologyCardsVisible();

    // When: Clicking on a technology card
    const firstCard = page.locator('app-technology').first();
    const cardLink = firstCard.locator('a');

    // Then: Card should have a link
    await expect(cardLink).toBeVisible();
    
    // And: Link should have a valid href
    const href = await cardLink.getAttribute('href');
    expect(href).toBeTruthy();
    expect(href).toMatch(/^https?:\/\//);
  });

  test('should display about section', async ({ homePage }) => {
    // Given: User is on the home page
    await homePage.expectPageLoaded();

    // When: Page content is loaded
    // Then: About section should be visible
    await expect(homePage.aboutSection).toBeVisible();
  });
});
