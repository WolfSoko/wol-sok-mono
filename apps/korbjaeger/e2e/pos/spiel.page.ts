import type { Locator, Page } from '@playwright/test';

/** `/spiel/{id}`: a Spiel's result, quarters, Halle and both Kader. */
export class SpielPage {
  /** Both Teams, home first, each linking to its Team page. */
  public readonly heading: Locator;
  /** Why the Spiel could not be read. */
  public readonly fehler: Locator;
  public readonly ergebnis: Locator;
  public readonly status: Locator;
  /** The quarter scores' lines, home first. */
  public readonly viertel: Locator;
  public readonly halle: Locator;
  /** Opens navigation to the Halle, in a tab of its own. */
  public readonly navigation: Locator;
  /** One per Team, home first. */
  public readonly kader: Locator;
  /** What the page says while there is no Spielbericht. */
  public readonly berichtFehlt: Locator;

  public constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.fehler = page.getByTestId('spiel-fehler');
    this.ergebnis = page.getByTestId('spiel-ergebnis');
    this.status = page.getByTestId('spiel-status');
    this.viertel = page.getByTestId('viertel-zeile');
    this.halle = page.getByTestId('halle');
    this.navigation = page.getByTestId('halle-navigation');
    this.kader = page.getByTestId('kader');
    this.berichtFehlt = page.getByTestId('spielbericht-fehlt');
  }

  public async goto(spielId: number): Promise<void> {
    await this.page.goto(`/spiel/${spielId}`);
  }

  /** The Kader headed by the Team `team`. */
  public kaderVon(team: string): Locator {
    return this.kader.filter({
      has: this.page.getByRole('heading', { level: 3, name: team }),
    });
  }

  /** The players of a Kader, as `kaderVon(team)` finds it. */
  public spieler(kader: Locator): Locator {
    return kader.getByTestId('kader-zeile');
  }

  /** What a Kader says when the Verband records no Spielerwerte. */
  public ohneWerte(kader: Locator): Locator {
    return kader.getByTestId('kader-ohne-werte');
  }
}
