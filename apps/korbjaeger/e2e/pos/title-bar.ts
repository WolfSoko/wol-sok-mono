import type { Locator, Page } from '@playwright/test';

/** The title bar above every page: back, forward, the breadcrumb and the actions. */
export class TitleBar {
  public readonly back: Locator;
  public readonly forward: Locator;
  public readonly breadcrumb: Locator;
  /** The breadcrumb's levels, the overview first. */
  public readonly levels: Locator;
  /** The breadcrumb's level of the page shown. */
  public readonly current: Locator;
  /** The action opening the search (`/suchen`). */
  public readonly search: Locator;

  public constructor(page: Page) {
    const bar = page.locator('korb-title-bar');
    this.back = bar.getByRole('button', { name: 'Zurück' });
    this.forward = bar.getByRole('button', { name: 'Vor' });
    this.breadcrumb = page.getByRole('navigation', { name: 'Seitenpfad' });
    this.levels = this.breadcrumb.getByRole('listitem');
    this.current = this.breadcrumb.locator('[aria-current="page"]');
    this.search = bar.getByRole('link', { name: 'Suchen', exact: true });
  }

  /** The breadcrumb's link to the level `title`. */
  public level(title: string): Locator {
    return this.breadcrumb.getByRole('link', { name: title, exact: true });
  }
}
