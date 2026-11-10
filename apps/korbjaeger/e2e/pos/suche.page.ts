import type { Locator, Page } from '@playwright/test';

/** One Verein of the club index, as `/api/clubs` serves it. */
export interface IndexedClubAnswer {
  readonly id: number;
  readonly name: string;
  readonly associations: readonly { id: number; name: string }[];
}

/** `/suchen` and a Verein's page below it, `/suchen/verein/{id}`. */
export class SuchePage {
  public readonly heading: Locator;
  /** The field the Verein's name is typed into. */
  public readonly vereinssuche: Locator;
  /** The Vereine the search lists. */
  public readonly vereine: Locator;
  /** What the search says: how many matched, or what to type. */
  public readonly status: Locator;
  /** A Verein page's Teams, each with its follow control. */
  public readonly teams: Locator;

  public constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.vereinssuche = page.getByRole('searchbox', {
      name: 'Name des Vereins',
    });
    this.vereine = page.getByTestId('verein');
    this.status = page.getByTestId('vereinssuche-status');
    this.teams = page.getByTestId('vereins-team');
  }

  /**
   * Serves `clubs` as the club index: the e2e server's Firestore holds
   * none, and the index is no DBB read the fake DBB could answer.
   */
  public async clubIndex(clubs: readonly IndexedClubAnswer[]): Promise<void> {
    await this.page.route('**/api/clubs', (route) =>
      route.fulfill({ json: clubs })
    );
  }

  public async goto(): Promise<void> {
    await this.page.goto('/suchen');
  }

  /** The Verein page's row of the Team `teamId`. */
  public team(teamId: number): Locator {
    return this.teams.filter({
      has: this.page.locator(`a[href="/team/${teamId}"]`),
    });
  }
}
