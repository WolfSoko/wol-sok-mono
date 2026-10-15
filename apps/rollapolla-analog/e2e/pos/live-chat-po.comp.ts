import { expect, Locator, Page } from '@playwright/test';

/** The live chat card; the fixture scrolls it into view so it hydrates. */
export class LiveChatPoComp {
  constructor(private readonly page: Page) {}

  /** Nobody is signed in with Google: the chat offers sign-in, not the form. */
  public async expectSignInRequired(): Promise<void> {
    await expect(this.page.getByTestId('chat-sign-in-button')).toBeVisible();
    await expect(this.page.getByTestId('message-input')).toHaveCount(0);
  }

  public async enterUntrimmedMessage(message: string): Promise<string> {
    const messageInput = await this.openMessageInput();
    await messageInput.fill(message);
    await this.page.getByRole('button', { name: 'Send message' }).click();
    return message;
  }

  public async sendMessageByKeypress(message: string): Promise<void> {
    const messageInput = await this.openMessageInput();
    await messageInput.fill(message);
    await messageInput.press('Control+Enter');
  }

  public findMessageInChat(message: string): Locator {
    return this.page.getByTestId('messages-list').getByText(message);
  }

  // The input exists only once the chat hydrated and the account is a Google
  // one: the server renders the sign-in offer.
  private async openMessageInput(): Promise<Locator> {
    const messageInput: Locator = this.page.getByTestId('message-input');
    await expect(messageInput).toBeVisible();
    return messageInput;
  }
}
