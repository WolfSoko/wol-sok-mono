import { expect, type Locator, type Page } from '@playwright/test';
import { folgenKnopf } from './folgen';

/** `/team-einrichten`: from Verband to Team, step by step. */
export class TeamEinrichtenPage {
  public readonly heading: Locator;
  /** Reads the next page of Ligen. */
  public readonly weitereLigen: Locator;
  public readonly ligen: Locator;
  public readonly teams: Locator;

  public constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.weitereLigen = page.getByRole('button', { name: 'Weitere Ligen' });
    this.ligen = page.getByTestId('league');
    this.teams = page.getByTestId('team');
  }

  public async goto(): Promise<void> {
    await this.page.goto('/team-einrichten');
  }

  /**
   * Picks `option` in the select labelled `label`, and waits until its
   * panel is gone, so the next click reaches the page. Clicks the form
   * field, as a finger does: an empty select lies under its label.
   */
  public async waehlen(label: string, option: string): Promise<void> {
    await this.page
      .locator('mat-form-field')
      .filter({ has: this.page.getByRole('combobox', { name: label }) })
      .click();
    const panel = this.page.getByRole('listbox', { name: label });
    await panel.getByRole('option', { name: option, exact: true }).click();
    await panel.waitFor({ state: 'detached' });
  }

  /** The Liga named `name` in the list. */
  public liga(name: string): Locator {
    return this.ligen.filter({
      has: this.page.getByText(name, { exact: true }),
    });
  }

  /** The control beside a followed Team's row that unfollows it. */
  public nichtMehrFolgen(name: string): Locator {
    return folgenKnopf(this.page, name, { gefolgt: true });
  }

  /**
   * Walks the wizard to the Teams of the Liga `liga`: picks Verband,
   * Altersklasse and Geschlecht, then reads further pages of Ligen until
   * `liga` is listed, and opens it.
   */
  public async ligaOeffnen(auswahl: {
    readonly verband: string;
    readonly altersklasse: string;
    readonly geschlecht: string;
    readonly liga: string;
  }): Promise<void> {
    await this.waehlen('Verband', auswahl.verband);
    await this.waehlen('Altersklasse', auswahl.altersklasse);
    await this.waehlen('Geschlecht', auswahl.geschlecht);
    await expect(this.ligen.first()).toBeVisible();
    while ((await this.liga(auswahl.liga).count()) === 0) {
      const bisher = await this.ligen.count();
      await this.weitereLigen.click();
      await expect(this.ligen).not.toHaveCount(bisher);
    }
    await this.liga(auswahl.liga).click();
  }

  /** The Team named `name` in the list of the picked Liga's Teams. */
  public team(name: string): Locator {
    return this.teams.filter({
      has: this.page.getByText(name, { exact: true }),
    });
  }
}
