import { test, expect, Locator } from '@playwright/test';

test.describe('Home', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('has title', async ({ page }) => {
    // Expect h1 to contain a substring.
    await expect(
      page.getByRole('heading', {
        name: 'RollaPolla',
      })
    ).toBeVisible();
    await expect(page.getByText('Polls for everyone!')).toBeVisible();
  });

  test('informs about coming soon', async ({ page }) => {
    await expect(page.getByTestId('coming-soon')).toContainText('Coming Soon!');
  });

  test('has a cta to follow on twitter', async ({ page }) => {
    const twitterLink: Locator = page.getByRole('link', {
      name: 'Follow along on Twitter',
    });
    await expect(twitterLink).toBeVisible();
    expect(await twitterLink.getAttribute('href')).toContain(
      'https://twitter.com/rollapolla'
    );
    await expect(twitterLink).toHaveAttribute('target', '_blank');
  });
});
