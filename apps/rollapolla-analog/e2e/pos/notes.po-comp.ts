import { expect, Locator, Page } from '@playwright/test';

export class NotesPoComp {
  constructor(private readonly page: Page) {}

  async leaveTrimmedNote() {
    const leaveNoteInput: Locator = this.page.getByTestId('note-input');
    await expect(leaveNoteInput).toBeVisible();
    await leaveNoteInput.scrollIntoViewIfNeeded();

    const message = `  Hello, world!${Math.random()}  `;
    await leaveNoteInput.click();
    await leaveNoteInput.fill(message);

    await this.page.click('button[type="submit"]');

    await expect(
      this.page.getByTestId('notes-list').getByText(message.trim())
    ).toBeVisible();
  }

  async sendNoteByKeypress() {
    const leaveNoteInput: Locator = this.page.getByTestId('note-input');
    await expect(leaveNoteInput).toBeVisible();
    await leaveNoteInput.scrollIntoViewIfNeeded();

    const message = `Hello World from Playwright ${Math.random()}`;

    await leaveNoteInput.click();
    await leaveNoteInput.fill(message);

    await leaveNoteInput.press('Control+Enter');

    await expect(
      this.page.getByTestId('notes-list').getByText(message.trim())
    ).toBeVisible();
  }
}
