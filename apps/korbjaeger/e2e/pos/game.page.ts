import type { Locator, Page } from '@playwright/test';
import { lineColor } from './line-color';

/** `/spiel/{id}`: a Spiel's result, quarters, Halle and both Kader. */
export class GamePage {
  /** Both Teams, home first, each linking to its Team page. */
  public readonly heading: Locator;
  /** Why the Spiel could not be read. */
  public readonly error: Locator;
  public readonly result: Locator;
  public readonly provisional: Locator;
  public readonly status: Locator;
  /** The quarter scores' lines, home first. */
  public readonly quarters: Locator;
  public readonly venue: Locator;
  /** Opens navigation to the Halle, in a tab of its own. */
  public readonly navigation: Locator;
  /** One per Team, home first. */
  public readonly roster: Locator;
  /** What the page says while there is no Spielbericht. */
  public readonly reportMissing: Locator;

  public constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.error = page.getByTestId('game-error');
    this.result = page.getByTestId('game-result');
    this.provisional = page.getByTestId('game-provisional');
    this.status = page.getByTestId('game-status');
    this.quarters = page.getByTestId('quarters-row');
    this.venue = page.getByTestId('venue');
    this.navigation = page.getByTestId('venue-navigation');
    this.roster = page.getByTestId('roster');
    this.reportMissing = page.getByTestId('game-report-missing');
  }

  /** The colour of the heading's court line, as the browser computes it. */
  public lineColor(): Promise<string> {
    return lineColor(this.heading);
  }

  public async goto(gameId: number): Promise<void> {
    await this.page.goto(`/spiel/${gameId}`);
  }

  /** The Kader headed by the Team `team`. */
  public rosterOf(team: string): Locator {
    return this.roster.filter({
      has: this.page.getByRole('heading', { level: 3, name: team }),
    });
  }

  /** The players of a Kader, as `rosterOf(team)` finds it. */
  public player(roster: Locator): Locator {
    return roster.getByTestId('roster-row');
  }

  /** The line of the player named `name` in a Kader, as `rosterOf(team)` finds it. */
  public playerNamed(roster: Locator, name: string): Locator {
    return this.player(roster).filter({ hasText: name });
  }

  /**
   * Marks the player named `name` in a followed Team's Kader as the Kind,
   * giving it `nickname` in the dialog.
   */
  public async markAsChild(
    roster: Locator,
    name: string,
    nickname: string
  ): Promise<void> {
    await this.playerNamed(roster, name)
      .getByRole('button', { name: 'Als mein Kind markieren' })
      .click();
    const dialog = this.page.getByRole('dialog', {
      name: 'Als mein Kind markieren',
    });
    await dialog.getByLabel('Spitzname (freiwillig)').fill(nickname);
    await dialog.getByRole('button', { name: 'Markieren' }).click();
    await dialog.waitFor({ state: 'detached' });
  }

  /** What a Kader says when the Verband records no Spielerwerte. */
  public withoutStats(roster: Locator): Locator {
    return roster.getByTestId('roster-without-stats');
  }
}
