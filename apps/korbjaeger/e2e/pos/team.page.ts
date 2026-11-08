import type { Locator, Page } from '@playwright/test';

/** One Spiel in the Team page's list. */
export interface SpielEintrag {
  readonly datum: string;
  readonly ort: string;
  readonly gegner: string;
  readonly liga: string;
  readonly ergebnis?: string;
}

/** `/team/{id}`: a Team's Spiele of the Saison and its Ligen's Tabellen. */
export class TeamPage {
  public readonly heading: Locator;
  public readonly spiele: Locator;
  /** One per Liga, the current one first. */
  public readonly tabellen: Locator;
  /** Follows the Team, or unfollows it once pressed. */
  public readonly folgen: Locator;
  /** The Verein's other Teams, each with its Ligen and a follow button. */
  public readonly vereinsTeams: Locator;

  public constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.spiele = page.getByTestId('spiel');
    this.tabellen = page.getByTestId('tabelle');
    this.folgen = page.getByRole('button', {
      name: 'Team folgen',
      exact: true,
    });
    this.vereinsTeams = page.getByTestId('vereins-team');
  }

  /** The Verein's other Team that plays in the Liga `liga`. */
  public vereinsTeam(liga: string): Locator {
    return this.vereinsTeams.filter({
      has: this.page.getByTestId('vereins-team-ligen').getByText(liga),
    });
  }

  /** The Tabelle headed by the Liga `liga`. */
  public tabelle(liga: string): Locator {
    return this.tabellen.filter({
      has: this.page.getByRole('heading', { level: 3, name: liga }),
    });
  }

  /** The lines of a Tabelle, as `tabelle(liga)` finds it. */
  public zeilen(tabelle: Locator): Locator {
    return tabelle.getByTestId('tabelle-zeile');
  }

  /** The line a Tabelle marks as the Team's own. */
  public eigeneZeile(tabelle: Locator): Locator {
    return tabelle.locator('[aria-current="true"]');
  }

  /** The Spiel against `gegner` in the list, a link to its Spiel page. */
  public spielGegen(gegner: string): Locator {
    return this.spiele.filter({
      has: this.page.getByTestId('spiel-gegner').getByText(gegner, {
        exact: true,
      }),
    });
  }

  public async goto(teamId: number): Promise<void> {
    await this.page.goto(`/team/${teamId}`);
  }

  /** Every Spiel as listed, top to bottom. */
  public async eintraege(): Promise<readonly SpielEintrag[]> {
    const zeilen = await this.spiele.all();
    return Promise.all(zeilen.map((zeile) => eintrag(zeile)));
  }
}

async function eintrag(zeile: Locator): Promise<SpielEintrag> {
  const text = (name: string): Promise<string> =>
    zeile.getByTestId(`spiel-${name}`).innerText();
  const ergebnis = zeile.getByTestId('spiel-ergebnis');
  return {
    datum: await text('datum'),
    ort: await text('ort'),
    gegner: await text('gegner'),
    liga: await text('liga'),
    ...((await ergebnis.count()) > 0
      ? { ergebnis: await ergebnis.innerText() }
      : {}),
  };
}
