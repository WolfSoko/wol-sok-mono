import { test, expect, Locator } from '@playwright/test';

test.describe('Leave a note', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should provide a way to leave a note', async ({ page }) => {
    const leaveNoteInput: Locator = await page.getByRole('textbox', {
      name: 'Your note',
    });
    await expect(leaveNoteInput).toBeVisible();
  });
});
