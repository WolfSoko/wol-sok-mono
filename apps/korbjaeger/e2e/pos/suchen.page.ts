import type { Locator, Page } from '@playwright/test';

/** `/suchen`: a Team by its Verein's name, or through its Liga. */
export class SuchenPage {
  public readonly heading: Locator;
  /** The field for the Verein's name. */
  public readonly vereinssuche: Locator;
  /** One per Verein the search lists. */
  public readonly vereine: Locator;
  /** What the search says where the Verein list holds no Verein yet. */
  public readonly leer: Locator;
  /** What the search says where no Verein matches. */
  public readonly keinTreffer: Locator;
  /** Why the Verein list could not be loaded. */
  public readonly fehler: Locator;
  /** Opens the Liga wizard. */
  public readonly ueberLiga: Locator;

  public constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.vereinssuche = page.getByRole('searchbox', {
      name: 'Name des Vereins',
    });
    this.vereine = page.getByTestId('verein');
    this.leer = page.getByTestId('vereinssuche-leer');
    this.keinTreffer = page.getByTestId('vereinssuche-kein-treffer');
    this.fehler = page.getByTestId('vereinssuche-fehler');
    this.ueberLiga = page.getByRole('link', { name: 'Über die Liga suchen' });
  }

  public async goto(): Promise<void> {
    await this.page.goto('/suchen');
  }

  /** The listed Verein named `name`. */
  public verein(name: string): Locator {
    return this.vereine.filter({ hasText: name });
  }
}
