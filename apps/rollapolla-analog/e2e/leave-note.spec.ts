import { test, expect, Locator } from '@playwright/test';

test.describe('Leave a note', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should provide a way to leave a trimmed note', async ({ page }) => {
    const leaveNoteInput: Locator = page.getByTestId('note-input');
    await expect(leaveNoteInput).toBeVisible();

    const message = `         Hello, world!${Math.random()}        `;
    await leaveNoteInput.fill(message);

    await page.click('button[type="submit"]');

    await expect(
      page.getByTestId('note-note').getByText(message.trim())
    ).toBeVisible();
  });

  test('should send note by keypress CTRL+ENTER', async ({ page }) => {
    const leaveNoteInput: Locator = page.getByTestId('note-input');
    await expect(leaveNoteInput).toBeVisible();

    const message = `Hello World from Playwright ${Math.random()}`;
    await leaveNoteInput.fill(message);

    await leaveNoteInput.press('Control+Enter');

    await expect(
      page.getByTestId('note-note').getByText(message.trim())
    ).toBeVisible();
  });
});
