import type { Locator, Page } from '@playwright/test';

/**
 * `/suchen`: a Team by its Verein's name, or through its Liga; and
 * `/suchen/kind`, the same search on to marking the Kind.
 */
export class SearchPage {
  public readonly heading: Locator;
  /** The field for the Verein's name. */
  public readonly clubSearch: Locator;
  /** One per Verein the search lists. */
  public readonly clubs: Locator;
  /** What the search says where the Verein list holds no Verein yet. */
  public readonly empty: Locator;
  /** What the search says where no Verein matches. */
  public readonly noHits: Locator;
  /** Why the Verein list could not be loaded. */
  public readonly failure: Locator;
  /** Opens the Liga wizard. */
  public readonly byLeague: Locator;
  /** Opens the search "Über mein Kind". */
  public readonly byChild: Locator;
  /** On a Verein's page of the search "Über mein Kind": how to go on. */
  public readonly followFirst: Locator;

  public constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.clubSearch = page.getByRole('searchbox', {
      name: 'Name des Vereins',
    });
    this.clubs = page.getByTestId('club');
    this.empty = page.getByTestId('club-search-empty');
    this.noHits = page.getByTestId('club-search-no-hits');
    this.failure = page.getByTestId('club-search-failure');
    this.byLeague = page.getByRole('link', { name: 'Über die Liga suchen' });
    this.byChild = page.getByRole('link', { name: 'Über mein Kind suchen' });
    this.followFirst = page.getByTestId('child-search-follow-first');
  }

  public async goto(): Promise<void> {
    await this.page.goto('/suchen');
  }

  /** Opens a Verein's page of the search "Über mein Kind". */
  public async gotoChildClub(clubId: number): Promise<void> {
    await this.page.goto(`/suchen/kind/verein/${clubId}`);
  }

  /** The link on to marking the Kind in `team`'s last played Spiel. */
  public markChild(team: Locator, teamName: string): Locator {
    return team.getByRole('link', {
      name: `Kind im Kader markieren: ${teamName}`,
    });
  }

  /** The listed Verein named `name`. */
  public club(name: string): Locator {
    return this.clubs.filter({ hasText: name });
  }
}
