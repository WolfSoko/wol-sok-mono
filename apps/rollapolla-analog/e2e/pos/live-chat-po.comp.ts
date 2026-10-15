import { expect, Locator, Page } from '@playwright/test';

export class LiveChatPoComp {
  constructor(private readonly page: Page) {}

  async enterUntrimmedMessage(message: string) {
    const leaveMessageInput: Locator = this.page.getByTestId('message-input');
    await expect(leaveMessageInput).toBeVisible();
    await leaveMessageInput.scrollIntoViewIfNeeded();

    await this.fillOnceHydrated(leaveMessageInput, message);

    await this.page.getByRole('button', { name: 'Send message' }).click();
    return message;
  }

  async sendMessageByKeypress(message: string) {
    const leaveMessageInput: Locator = this.page.getByTestId('message-input');
    await expect(leaveMessageInput).toBeVisible();
    await leaveMessageInput.scrollIntoViewIfNeeded();

    await this.fillOnceHydrated(leaveMessageInput, message);

    await leaveMessageInput.press('Control+Enter');
  }

  findMessageInChat(message: string): Locator {
    return this.page.getByTestId('messages-list').getByText(message);
  }

  // The chat hydrates once it is in the viewport; typing earlier is lost.
  private async fillOnceHydrated(
    input: Locator,
    message: string
  ): Promise<void> {
    await expect(async () => {
      await input.fill(message);
      await expect(
        this.page.getByText(`${message.length}/`, { exact: false })
      ).toBeVisible({ timeout: 1000 });
    }).toPass();
  }
}
