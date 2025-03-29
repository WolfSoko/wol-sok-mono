import { expect, Locator, Page } from '@playwright/test';

export class LiveChatPoComp {
  constructor(private readonly page: Page) {}

  async enterUntrimmedMessage(message: string) {
    const leaveNoteInput: Locator = this.page.getByTestId('note-input');
    await expect(leaveNoteInput).toBeVisible();
    await leaveNoteInput.scrollIntoViewIfNeeded();

    await leaveNoteInput.click();
    await leaveNoteInput.fill(message);

    await this.page.click('button[type="submit"]');
    return message;
  }

  async sendMessageByKeypress(message: string) {
    const leaveNoteInput: Locator = this.page.getByTestId('note-input');
    await expect(leaveNoteInput).toBeVisible();
    await leaveNoteInput.scrollIntoViewIfNeeded();

    await leaveNoteInput.click();
    await leaveNoteInput.fill(message);

    await leaveNoteInput.press('Control+Enter');
  }

  findMessageInChat(message: string): Locator {
    return this.page.getByTestId('notes-list').getByText(message);
  }
}
