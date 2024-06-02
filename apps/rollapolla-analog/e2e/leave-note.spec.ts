import { test, expect, Locator } from '@playwright/test';

test.describe('Leave a note', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should provide a way to leave a note', async ({ page }) => {
    const leaveNoteInput: Locator = page.getByTestId('note-input');
    await expect(leaveNoteInput).toBeVisible();

    await leaveNoteInput.fill('Hello, world!                  ');

    await page.click('button[type="submit"]');

    // await expect(page.getByTestId('note-note')).toContainText('Hello, world!');
  });
});
