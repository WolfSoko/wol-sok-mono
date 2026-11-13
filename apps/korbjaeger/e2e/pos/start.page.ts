import type { Locator, Page } from '@playwright/test';
import { folgenKnopf } from './folgen';

/** `/`: the overview of Meine Teams and Kinder. */
export class StartPage {
  /** One per marked Kind, the one that plays first first. */
  public readonly kinder: Locator;
  /** One per followed Team without a Kind, the one that plays first first. */
  public readonly teams: Locator;
  /** What the overview says while no Team is followed. */
  public readonly leer: Locator;
  /** Opens the search, offered while no Team is followed. */
  public readonly searchTeam: Locator;
  /** Opens the search, offered below the cards once a Team is followed. */
  public readonly searchFurtherTeam: Locator;

  public constructor(private readonly page: Page) {
    this.kinder = page.getByTestId('ueberblick-kind');
    this.teams = page.getByTestId('ueberblick-team');
    this.leer = page.getByTestId('ueberblick-leer');
    this.searchTeam = this.leer.getByRole('link', { name: 'Team suchen' });
    this.searchFurtherTeam = page.getByRole('link', {
      name: 'Weiteres Team suchen',
    });
  }

  /** Whether the card `team` wears a Verein's colours (its own `--mat-sys-*` tokens). */
  public traegtVereinsfarben(team: Locator): Promise<boolean> {
    return team.evaluate(
      (karte) =>
        // the card's host, korb-ueberblick-team, holds the tokens
        (karte.closest('korb-ueberblick-team') as HTMLElement | null)?.style
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

  /** The control that unfollows the Team `name`, on its card or a Kind's. */
  public nichtMehrFolgen(name: string): Locator {
    return folgenKnopf(this.page, name, { gefolgt: true });
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
