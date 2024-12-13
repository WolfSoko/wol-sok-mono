import { expect, Locator, Page } from '@playwright/test';

export class NotesPoComp {
  constructor(private readonly page: Page) {}

  async leaveTrimmedNote() {
    const leaveNoteInput: Locator = this.page.getByTestId('note-input');
    await expect(leaveNoteInput).toBeVisible();
    await leaveNoteInput.scrollIntoViewIfNeeded();

    const message = `  Hello, world!${Math.random()}  `;
    // wait to give angular time to hydrate component
    await this.page.waitForTimeout(3000);

    await leaveNoteInput.fill(message);

    await this.page.click('button[type="submit"]');

    await expect(
      this.page.getByTestId('note-note').getByText(message.trim())
    ).toBeVisible();
  }

  async sendNoteByKeypress() {
    const leaveNoteInput: Locator = this.page.getByTestId('note-input');
    await expect(leaveNoteInput).toBeVisible();
    await leaveNoteInput.scrollIntoViewIfNeeded();

    const message = `Hello World from Playwright ${Math.random()}`;
    // wait to give angular time to hydrate component
    await this.page.waitForTimeout(3000);
    await leaveNoteInput.fill(message);

    await leaveNoteInput.press('Control+Enter');

    await expect(
      this.page.getByTestId('note-note').getByText(message.trim())
    ).toBeVisible();
  }
}
