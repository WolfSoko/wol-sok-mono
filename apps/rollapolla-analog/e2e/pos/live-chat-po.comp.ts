import { expect, Locator, Page } from '@playwright/test';

export class LiveChatPoComp {
  constructor(private readonly page: Page) {}

  async enterUntrimmedMessage(message: string) {
    const leaveMessageInput: Locator = this.page.getByTestId('message-input');
    await expect(leaveMessageInput).toBeVisible();
    await leaveMessageInput.scrollIntoViewIfNeeded();

    await leaveMessageInput.click();
    await leaveMessageInput.fill(message);

    await this.page.click('button[type="submit"]');
    return message;
  }

  async sendMessageByKeypress(message: string) {
    const leaveMessageInput: Locator = this.page.getByTestId('message-input');
    await expect(leaveMessageInput).toBeVisible();
    await leaveMessageInput.scrollIntoViewIfNeeded();

    await leaveMessageInput.click();
    await leaveMessageInput.fill(message);

    await leaveMessageInput.press('Control+Enter');
  }

  findMessageInChat(message: string): Locator {
    return this.page.getByTestId('messages-list').getByText(message);
  }
}
