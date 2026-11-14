import type { Locator, Page } from '@playwright/test';

/** An account of the Auth emulator, invented. */
export interface EmulatorAccount {
  readonly email: string;
  readonly name: string;
}

/**
 * `/einstellungen`: the Google account. Signs in through the Auth
 * emulator's popup (`korbjaeger:emulatoren`), which stands in for Google's.
 */
export class SettingsPage {
  public readonly signIn: Locator;
  public readonly signOut: Locator;
  public readonly deleteAccountButton: Locator;
  /** Who is signed in, as the settings name them. */
  public readonly accountName: Locator;

  public constructor(private readonly page: Page) {
    this.signIn = page.getByTestId('sign-in');
    this.signOut = page.getByTestId('sign-out');
    this.deleteAccountButton = page.getByTestId('delete-account');
    this.accountName = page.getByTestId('account-name');
  }

  public async goto(): Promise<void> {
    await this.page.goto('/einstellungen');
  }

  /** The look `name` ("System", "Hell" or "Dunkel") in the card Darstellung. */
  public appearance(name: 'System' | 'Hell' | 'Dunkel'): Locator {
    return this.page
      .getByRole('radiogroup', { name: 'Darstellung' })
      .getByRole('radio', { name, exact: true });
  }

  /** Signs in as `account`, adding it to the emulator where it is new. */
  public async signInAs(
    account: EmulatorAccount,
    { freshAccount: fresh }: { freshAccount: boolean }
  ): Promise<void> {
    await this.inPopup(() => this.signIn.click(), account, {
      freshAccount: fresh,
    });
  }

  /** Deletes the account, confirming in the dialog and at Google as `account`. */
  public async deleteAccount(account: EmulatorAccount): Promise<void> {
    await this.deleteAccountButton.click();
    await this.inPopup(
      () => this.page.getByTestId('delete-account-confirm').click(),
      account,
      { freshAccount: false }
    );
  }

  /** Clicks with `click` and answers the Auth emulator's popup as `account`. */
  private async inPopup(
    click: () => Promise<void>,
    account: EmulatorAccount,
    { freshAccount: fresh }: { freshAccount: boolean }
  ): Promise<void> {
    const popupOpens = this.page.context().waitForEvent('page');
    await click();
    const popup = await popupOpens;
    // the emulator's page takes clicks only once its script is in
    await popup.waitForLoadState('networkidle');
    if (fresh) {
      await popup.getByRole('button', { name: 'Add new account' }).click();
      await popup.locator('#email-input').fill(account.email);
      await popup.locator('#display-name-input').fill(account.name);
      await popup
        .getByRole('button', { name: 'Sign in with Google.com' })
        .click();
    } else {
      await popup.getByText(account.email).click();
    }
  }
}
