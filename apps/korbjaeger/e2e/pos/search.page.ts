import type { Locator, Page } from '@playwright/test';

/** `/suchen`: a Team by its Verein's name, or through its Liga. */
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
  }

  public async goto(): Promise<void> {
    await this.page.goto('/suchen');
  }

  /** The listed Verein named `name`. */
  public club(name: string): Locator {
    return this.clubs.filter({ hasText: name });
  }
}
