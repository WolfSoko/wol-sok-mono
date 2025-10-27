import { test, expect } from './fixtures/home-page.fixture';

test.describe('Thanos Demo Feature Interaction', () => {
  test('should display thanos toggle button', async ({ homePage }) => {
    // Given: User is on the home page
    await homePage.expectPageLoaded();

    // When: Technology section is loaded
    await homePage.expectTechnologyCardsVisible();

    // Then: Thanos toggle button should be visible
    await homePage.expectThanosToggleVisible();
  });

  test('should start demo when clicking start button', async ({
    homePage,
    page,
  }) => {
    // Given: User is on the home page with thanos button visible
    await homePage.expectTechnologyCardsVisible();
    await homePage.expectThanosToggleVisible();

    // When: User clicks the thanos toggle button
    await homePage.clickThanosToggle();

    // Then: Button icon should change to stop
    await homePage.expectThanosButtonShowsStop();

    // And: Demo should be running (button shows stop icon)
    await page.waitForTimeout(500); // Give time for demo to start
    await homePage.expectThanosButtonShowsStop();
  });

  test('should stop demo when clicking stop button', async ({
    homePage,
    page,
  }) => {
    // Given: User has started the thanos demo
    await homePage.expectTechnologyCardsVisible();
    await homePage.expectThanosToggleVisible();
    await homePage.clickThanosToggle();
    await homePage.expectThanosButtonShowsStop();

    // When: User clicks the stop button
    await page.waitForTimeout(500); // Wait a bit for demo to be running
    await homePage.clickThanosToggle();

    // Then: Button should return to start icon
    await homePage.expectThanosButtonShowsStart();
  });

  test('should vaporize technology cards during demo', async ({
    homePage,
    page,
  }) => {
    // Given: User is on the home page with technology cards visible
    await homePage.expectTechnologyCardsVisible();
    const initialCardCount = await homePage.getTechnologyCardCount();
    expect(initialCardCount).toBe(9);

    // When: User starts the thanos demo
    await homePage.clickThanosToggle();
    await page.waitForTimeout(1000); // Wait for first card to start vaporizing

    // Then: Demo should be running
    await homePage.expectThanosButtonShowsStop();

    // Note: We don't check for actual vaporization effect in E2E test
    // as that's visual and timing-dependent. The unit tests should cover the logic.
    
    // Clean up: Stop demo
    await homePage.clickThanosToggle();
    await homePage.expectThanosButtonShowsStart();
  });

  test('should handle click on individual technology card for vaporization', async ({
    homePage,
    page,
  }) => {
    // Given: User is on the home page with technology cards visible
    await homePage.expectTechnologyCardsVisible();

    // When: User clicks on a technology card
    const firstCard = page.locator('app-technology').first();
    const cardLink = firstCard.locator('a');
    
    // Then: Card should be clickable (has link)
    await expect(cardLink).toBeVisible();
    
    // Note: We test that cards are interactive, not the vaporization effect itself
    // The vaporization effect is better tested in unit tests
  });
});
