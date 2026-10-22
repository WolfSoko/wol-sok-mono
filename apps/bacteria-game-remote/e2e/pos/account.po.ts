import { expect, Locator, Page } from '@playwright/test';

/**
 * The player's account in the profile, against the Firebase Auth emulator:
 * its Google popup lists the accounts made so far and makes new ones.
 */
export class AccountPo {
  public readonly account: Locator;
  public readonly signInCta: Locator;
  public readonly signOutCta: Locator;
  public readonly medallions: Locator;

  constructor(private readonly page: Page) {
    this.account = page.locator('feat-lazy-bac-game-account');
    this.signInCta = page.getByRole('button', { name: 'Sign in with Google' });
    this.signOutCta = page.getByRole('button', { name: 'Sign out' });
    this.medallions = page
      .locator('.figure', { hasText: 'Medallions' })
      .locator('dd');
  }

  /**
   * Signs in with Google: to a new account named after the email, or to
   * one made before.
   */
  public async signIn(email: string, { existing = false } = {}): Promise<void> {
    const [popup] = await Promise.all([
      this.page.waitForEvent('popup'),
      this.signInCta.click(),
    ]);
    if (existing) {
      await popup.getByText(email).click();
    } else {
      await popup
        .getByRole('button', { name: /Add new account/ })
        .first()
        .click();
      await popup.getByLabel('Email').fill(email);
      await popup.getByLabel('Display name').fill(nameOf(email));
      await popup
        .getByRole('button', { name: 'Sign in with Google.com' })
        .click();
    }
    await expect(this.account).toContainText(`Signed in as ${nameOf(email)}`);
  }

  public async signOut(): Promise<void> {
    await this.signOutCta.click();
    await expect(this.account).toContainText('Playing as a guest');
  }
}

/** An email no other test, browser or retry uses. */
export function uniqueEmail(name: string): string {
  return `${name}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

/** The display name the account of an email is given. */
function nameOf(email: string): string {
  return email.split('@')[0];
}
