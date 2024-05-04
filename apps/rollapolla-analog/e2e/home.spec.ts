import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');

  // Expect h1 to contain a substring.
  await expect(
    page.getByRole('heading', {
      name: 'RollaPolla.com. Polls for everyone!',
    })
  ).toBeVisible();
});

test('informs about coming soon', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('coming-soon')).toContainText('Coming Soon!');
});
