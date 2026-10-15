import { expect, Page } from '@playwright/test';

export class AccountPo {
  constructor(private readonly page: Page) {}

  /** Signs in through the Auth emulator's Google popup with a new account. */
  async signInWithNewGoogleAccount(displayName: string): Promise<void> {
    const signInButton = this.page.getByTestId('sign-in-button');
    await expect(signInButton).toBeEnabled();
    const [popup] = await Promise.all([
      this.page.waitForEvent('popup'),
      signInButton.click(),
    ]);
    await popup.waitForLoadState();
    // the emulator's page wires its buttons up only after loading its script
    await expect(async () => {
      await popup.getByText('Add new account').click();
      await expect(
        popup.getByText('Auto-generate user information')
      ).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15000 });
    await popup.getByText('Auto-generate user information').click();
    await popup.locator('#display-name-input').fill(displayName);
    await popup.getByText('Sign in with Google.com').click();
    await popup.waitForEvent('close');
  }

  async expectSignedInAs(displayName: string): Promise<void> {
    await expect(this.page.getByTestId('account-name')).toHaveText(displayName);
  }

  async signOut(): Promise<void> {
    await this.page.getByTestId('sign-out-button').click();
    await expect(this.page.getByTestId('sign-in-button')).toBeVisible();
  }
}
