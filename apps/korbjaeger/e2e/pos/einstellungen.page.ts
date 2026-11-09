import type { Locator, Page } from '@playwright/test';

/** An account of the Auth emulator, invented. */
export interface EmulatorKonto {
  readonly email: string;
  readonly name: string;
}

/**
 * `/einstellungen`: the Google account. Signs in through the Auth
 * emulator's popup (`korbjaeger:emulatoren`), which stands in for Google's.
 */
export class EinstellungenPage {
  public readonly anmelden: Locator;
  public readonly abmelden: Locator;
  public readonly kontoLoeschen: Locator;
  /** Who is signed in, as the settings name them. */
  public readonly kontoName: Locator;

  public constructor(private readonly page: Page) {
    this.anmelden = page.getByTestId('anmelden');
    this.abmelden = page.getByTestId('abmelden');
    this.kontoLoeschen = page.getByTestId('konto-loeschen');
    this.kontoName = page.getByTestId('konto-name');
  }

  public async goto(): Promise<void> {
    await this.page.goto('/einstellungen');
  }

  /** Signs in as `konto`, adding it to the emulator where it is new. */
  public async anmeldenAls(
    konto: EmulatorKonto,
    { neu }: { neu: boolean }
  ): Promise<void> {
    await this.imPopup(() => this.anmelden.click(), konto, { neu });
  }

  /** Deletes the account, confirming in the dialog and at Google as `konto`. */
  public async loeschen(konto: EmulatorKonto): Promise<void> {
    await this.kontoLoeschen.click();
    await this.imPopup(
      () => this.page.getByTestId('konto-loeschen-bestaetigen').click(),
      konto,
      { neu: false }
    );
  }

  /** Clicks with `klicken` and answers the Auth emulator's popup as `konto`. */
  private async imPopup(
    klicken: () => Promise<void>,
    konto: EmulatorKonto,
    { neu }: { neu: boolean }
  ): Promise<void> {
    const popupKommt = this.page.context().waitForEvent('page');
    await klicken();
    const popup = await popupKommt;
    // the emulator's page takes clicks only once its script is in
    await popup.waitForLoadState('networkidle');
    if (neu) {
      await popup.getByRole('button', { name: 'Add new account' }).click();
      await popup.locator('#email-input').fill(konto.email);
      await popup.locator('#display-name-input').fill(konto.name);
      await popup
        .getByRole('button', { name: 'Sign in with Google.com' })
        .click();
    } else {
      await popup.getByText(konto.email).click();
    }
  }
}
