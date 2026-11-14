import type { Locator, Page } from '@playwright/test';
import { followButton } from './follow';

/** `/`: the overview of Meine Teams and Kinder. */
export class StartPage {
  /** One per marked Kind, the one that plays first first. */
  public readonly children: Locator;
  /** One per followed Team without a Kind, the one that plays first first. */
  public readonly teams: Locator;
  /** What the overview says while no Team is followed. */
  public readonly empty: Locator;
  /** Opens the search, offered while no Team is followed. */
  public readonly searchTeam: Locator;
  /** Opens the search, offered below the cards once a Team is followed. */
  public readonly searchFurtherTeam: Locator;

  public constructor(private readonly page: Page) {
    this.children = page.getByTestId('overview-child');
    this.teams = page.getByTestId('overview-team');
    this.empty = page.getByTestId('overview-empty');
    this.searchTeam = this.empty.getByRole('link', { name: 'Team suchen' });
    this.searchFurtherTeam = page.getByRole('link', {
      name: 'Weiteres Team suchen',
    });
  }

  /** Whether the card `team` wears a Verein's colours (its own `--mat-sys-*` tokens). */
  public wearsClubColors(team: Locator): Promise<boolean> {
    return team.evaluate(
      (card) =>
        // the card's host, korb-overview-team, holds the tokens
        (card.closest('korb-overview-team') as HTMLElement | null)?.style
          .getPropertyValue('--mat-sys-primary')
          .startsWith('light-dark(') ?? false
    );
  }

  public async goto(): Promise<void> {
    await this.page.goto('/');
  }

  /** The overview's entry of the Team named `name`. */
  public team(name: string): Locator {
    return this.teams.filter({
      has: this.page.getByTestId('overview-name').getByText(name, {
        exact: true,
      }),
    });
  }

  /** The overview's entry of the Kind called `name` (Spitzname or first name). */
  public child(name: string): Locator {
    return this.children.filter({
      has: this.page.getByTestId('overview-child-name').getByText(name, {
        exact: true,
      }),
    });
  }

  /** The Teams a Kind plays for, as `kind(name)` finds it. */
  public childTeams(child: Locator): Locator {
    return child.getByTestId('overview-child-teams');
  }

  /** Whether a Kind was on the Kader of its last Spiel. */
  public rosterFlag(child: Locator): Locator {
    return child.getByTestId('overview-roster');
  }

  /** The next Spiel of an entry, as `team(name)` or `kind(name)` finds it. */
  public nextGame(team: Locator): Locator {
    return team.getByTestId('overview-next');
  }

  /** The control that unfollows the Team `name`, on its card or a Kind's. */
  public unfollow(name: string): Locator {
    return followButton(this.page, name, { followed: true });
  }

  /** The snackbar's "Rückgängig", offered once a card unfollowed its Team. */
  public get undo(): Locator {
    return this.page.getByRole('button', { name: 'Rückgängig' });
  }

  /** The last result of an entry, as `team(name)` or `kind(name)` finds it. */
  public lastResult(team: Locator): Locator {
    return team.getByTestId('overview-last');
  }
}
