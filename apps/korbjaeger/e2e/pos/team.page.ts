import type { Locator, Page } from '@playwright/test';
import { lineColor } from './line-color';

/** One Spiel in the Team page's list. */
export interface GameEntry {
  readonly date: string;
  readonly venue: string;
  readonly opponent: string;
  readonly league: string;
  readonly result?: string;
}

/** `/team/{id}`: a Team's Spiele of the Saison and its Ligen's Tabellen. */
export class TeamPage {
  public readonly heading: Locator;
  public readonly games: Locator;
  /** One per Liga, the current one first. */
  public readonly standingsTables: Locator;
  /** Follows the Team, offered while it is not followed. */
  public readonly follow: Locator;
  /** Unfollows the Team, offered while it is followed. */
  public readonly unfollow: Locator;
  /** The Verein's other Teams, each with its Ligen and a follow button. */
  public readonly clubTeams: Locator;
  /** Where the Spiele are the last good data: why, and how old. */
  public readonly asOf: Locator;

  public constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.games = page.getByTestId('game');
    this.standingsTables = page.getByTestId('standings');
    this.follow = page.getByRole('button', {
      name: 'Team folgen',
      exact: true,
    });
    this.unfollow = page.getByRole('button', {
      name: 'Nicht mehr folgen',
      exact: true,
    });
    this.clubTeams = page.getByTestId('club-team');
    this.asOf = page.getByTestId('team-as-of');
  }

  /** The Verein's other Team that plays in the Liga `league`. */
  public clubTeam(league: string): Locator {
    return this.clubTeams.filter({
      has: this.page.getByTestId('club-team-leagues').getByText(league),
    });
  }

  /** The Tabelle headed by the Liga `league`. */
  public standings(league: string): Locator {
    return this.standingsTables.filter({
      has: this.page.getByRole('heading', { level: 3, name: league }),
    });
  }

  /** The lines of a Tabelle, as `standings(league)` finds it. */
  public rows(standings: Locator): Locator {
    return standings.getByTestId('standings-row');
  }

  /** The line a Tabelle marks as the Team's own. */
  public ownRow(standings: Locator): Locator {
    return standings.locator('[aria-current="true"]');
  }

  /** The Spiel against `opponent` in the list, a link to its Spiel page. */
  public gameAgainst(opponent: string): Locator {
    return this.games.filter({
      has: this.page.getByTestId('game-opponent').getByText(opponent, {
        exact: true,
      }),
    });
  }

  /** The bottom sheet "Vereinsfarben", while it is open. */
  public get clubColorsSheet(): Locator {
    return this.page.getByRole('dialog', { name: /Vereinsfarben/ });
  }

  /** The colour the court line under the heading takes, as the browser computes it. */
  public lineColor(): Promise<string> {
    return lineColor(this.heading);
  }

  /** Gives the Team's Verein the preset `primaryColor` through the bottom sheet. */
  public async chooseClubColors(primaryColor: string): Promise<void> {
    await this.page.getByRole('button', { name: 'Vereinsfarben' }).click();
    await this.clubColorsSheet
      .getByRole('radiogroup', { name: 'Hauptfarbe' })
      .getByRole('radio', { name: primaryColor })
      .click();
    await this.clubColorsSheet
      .getByRole('button', { name: 'Übernehmen' })
      .click();
  }

  /** Takes the Verein's colours away through the bottom sheet. */
  public async resetClubColors(): Promise<void> {
    await this.page.getByRole('button', { name: 'Vereinsfarben' }).click();
    await this.clubColorsSheet
      .getByRole('button', { name: 'Zurücksetzen' })
      .click();
  }

  public async goto(teamId: number): Promise<void> {
    await this.page.goto(`/team/${teamId}`);
  }

  /** Every Spiel as listed, top to bottom. */
  public async entries(): Promise<readonly GameEntry[]> {
    const rows = await this.games.all();
    return Promise.all(rows.map((row) => entry(row)));
  }
}

async function entry(row: Locator): Promise<GameEntry> {
  const text = (name: string): Promise<string> =>
    row.getByTestId(`game-${name}`).innerText();
  const result = row.getByTestId('game-result');
  return {
    date: await text('date'),
    venue: await text('home-or-away'),
    opponent: await text('opponent'),
    league: await text('league'),
    ...((await result.count()) > 0 ? { result: await result.innerText() } : {}),
  };
}
