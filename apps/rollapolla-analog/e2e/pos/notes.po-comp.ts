import { Locator, Page, expect } from '@playwright/test';

export class NotesPoComp {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/');
  }

  async leaveTrimmedNote() {
    const leaveNoteInput: Locator = this.page.getByTestId('note-input');
    await expect(leaveNoteInput).toBeVisible();

    const message = `         Hello, world!${Math.random()}        `;
    await leaveNoteInput.fill(message);

    await this.page.click('button[type="submit"]');

    await expect(
      this.page.getByTestId('note-note').getByText(message.trim())
    ).toBeVisible();
  }

  async sendNoteByKeypress() {
    const leaveNoteInput: Locator = this.page.getByTestId('note-input');
    await expect(leaveNoteInput).toBeVisible();

    const message = `Hello World from Playwright ${Math.random()}`;
    await leaveNoteInput.fill(message);

    await leaveNoteInput.press('Control+Enter');

    await expect(
      this.page.getByTestId('note-note').getByText(message.trim())
    ).toBeVisible();
  }
}
