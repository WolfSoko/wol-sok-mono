import { expect, Locator, Page } from '@playwright/test';

export class LiveChatPoComp {
  constructor(private readonly page: Page) {}

  /** Nobody is signed in with Google: the chat offers sign-in, not the form. */
  public async expectSignInRequired(): Promise<void> {
    await this.scrollChatIntoView();
    await expect(this.page.getByTestId('chat-sign-in')).toBeVisible();
    await expect(this.page.getByTestId('chat-sign-in-button')).toBeVisible();
    await expect(this.page.getByTestId('message-input')).toHaveCount(0);
  }

  public async enterUntrimmedMessage(message: string): Promise<string> {
    const leaveMessageInput = await this.openMessageInput();

    await this.fillOnceHydrated(leaveMessageInput, message);

    await this.page.getByRole('button', { name: 'Send message' }).click();
    return message;
  }

  public async sendMessageByKeypress(message: string): Promise<void> {
    const leaveMessageInput = await this.openMessageInput();

    await this.fillOnceHydrated(leaveMessageInput, message);

    await leaveMessageInput.press('Control+Enter');
  }

  public findMessageInChat(message: string): Locator {
    return this.page.getByTestId('messages-list').getByText(message);
  }

  // The chat hydrates once it is in the viewport. Until then it shows the
  // server-rendered sign-in offer, even to a signed-in visitor.
  private async scrollChatIntoView(): Promise<void> {
    await this.page.getByTestId('live-chat').scrollIntoViewIfNeeded();
  }

  private async openMessageInput(): Promise<Locator> {
    await this.scrollChatIntoView();
    const messageInput: Locator = this.page.getByTestId('message-input');
    await expect(messageInput).toBeVisible();
    return messageInput;
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
