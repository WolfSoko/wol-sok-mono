import type { Locator, Page } from '@playwright/test';

/** `/`: the overview of Meine Teams. */
export class StartPage {
  /** One per followed Team, the one that plays first first. */
  public readonly teams: Locator;
  /** What the overview says while no Team is followed. */
  public readonly leer: Locator;
  /** Opens the Team wizard, offered while no Team is followed. */
  public readonly teamEinrichten: Locator;

  public constructor(private readonly page: Page) {
    this.teams = page.getByTestId('ueberblick-team');
    this.leer = page.getByTestId('ueberblick-leer');
    this.teamEinrichten = this.leer.getByRole('link', {
      name: 'Team einrichten',
    });
  }

  public async goto(): Promise<void> {
    await this.page.goto('/');
  }

  /** The overview's entry of the Team named `name`. */
  public team(name: string): Locator {
    return this.teams.filter({
      has: this.page.getByTestId('ueberblick-name').getByText(name, {
        exact: true,
      }),
    });
  }

  /** The next Spiel of an entry, as `team(name)` finds it. */
  public naechstesSpiel(team: Locator): Locator {
    return team.getByTestId('ueberblick-naechstes');
  }

  /** The last result of an entry, as `team(name)` finds it. */
  public letztesErgebnis(team: Locator): Locator {
    return team.getByTestId('ueberblick-letztes');
  }
}
