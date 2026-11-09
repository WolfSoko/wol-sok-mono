import type { Locator, Page } from '@playwright/test';

/** `/`: the overview of Meine Teams and Kinder. */
export class StartPage {
  /** One per marked Kind, the one that plays first first. */
  public readonly kinder: Locator;
  /** One per followed Team without a Kind, the one that plays first first. */
  public readonly teams: Locator;
  /** What the overview says while no Team is followed. */
  public readonly leer: Locator;
  /** Opens the Team wizard, offered while no Team is followed. */
  public readonly teamEinrichten: Locator;

  public constructor(private readonly page: Page) {
    this.kinder = page.getByTestId('ueberblick-kind');
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

  /** The overview's entry of the Kind called `name` (Spitzname or first name). */
  public kind(name: string): Locator {
    return this.kinder.filter({
      has: this.page.getByTestId('ueberblick-kind-name').getByText(name, {
        exact: true,
      }),
    });
  }

  /** The Teams a Kind plays for, as `kind(name)` finds it. */
  public kindTeams(kind: Locator): Locator {
    return kind.getByTestId('ueberblick-kind-teams');
  }

  /** Whether a Kind was on the Kader of its last Spiel. */
  public kaderFlagge(kind: Locator): Locator {
    return kind.getByTestId('ueberblick-kader');
  }

  /** The next Spiel of an entry, as `team(name)` or `kind(name)` finds it. */
  public naechstesSpiel(team: Locator): Locator {
    return team.getByTestId('ueberblick-naechstes');
  }

  /** The control on a Team's card, as `team(name)` finds it, that unfollows it. */
  public nichtMehrFolgen(team: Locator): Locator {
    return team.getByRole('button', { name: /^Nicht mehr folgen: / });
  }

  /** The snackbar's "Rückgängig", offered once a card unfollowed its Team. */
  public get rueckgaengig(): Locator {
    return this.page.getByRole('button', { name: 'Rückgängig' });
  }

  /** The last result of an entry, as `team(name)` or `kind(name)` finds it. */
  public letztesErgebnis(team: Locator): Locator {
    return team.getByTestId('ueberblick-letztes');
  }
}
