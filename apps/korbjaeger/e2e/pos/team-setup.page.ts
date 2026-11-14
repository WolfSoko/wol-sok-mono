import { expect, type Locator, type Page } from '@playwright/test';
import { followButton } from './follow';

/** `/team-einrichten`: from Verband to Team, step by step. */
export class TeamSetupPage {
  public readonly heading: Locator;
  /** Reads the next page of Ligen. */
  public readonly moreLeagues: Locator;
  public readonly leagues: Locator;
  public readonly teams: Locator;

  public constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.moreLeagues = page.getByRole('button', { name: 'Weitere Ligen' });
    this.leagues = page.getByTestId('league');
    this.teams = page.getByTestId('team');
  }

  public async goto(): Promise<void> {
    await this.page.goto('/team-einrichten');
  }

  /**
   * Picks `option` in the select labelled `label`, and waits until its
   * panel is gone, so the next click reaches the page. Clicks the form
   * field, as a finger does: an empty select lies under its label.
   */
  public async choose(label: string, option: string): Promise<void> {
    await this.page
      .locator('mat-form-field')
      .filter({ has: this.page.getByRole('combobox', { name: label }) })
      .click();
    const panel = this.page.getByRole('listbox', { name: label });
    await panel.getByRole('option', { name: option, exact: true }).click();
    await panel.waitFor({ state: 'detached' });
  }

  /** The Liga named `name` in the list. */
  public league(name: string): Locator {
    return this.leagues.filter({
      has: this.page.getByText(name, { exact: true }),
    });
  }

  /** The control beside a followed Team's row that unfollows it. */
  public unfollow(name: string): Locator {
    return followButton(this.page, name, { followed: true });
  }

  /**
   * Walks the wizard to the Teams of the Liga `league`: picks Verband,
   * Altersklasse and Geschlecht, then reads further pages of Ligen until
   * `league` is listed, and opens it.
   */
  public async openLeague(selection: {
    readonly association: string;
    readonly ageGroup: string;
    readonly gender: string;
    readonly league: string;
  }): Promise<void> {
    await this.choose('Verband', selection.association);
    await this.choose('Altersklasse', selection.ageGroup);
    await this.choose('Geschlecht', selection.gender);
    await expect(this.leagues.first()).toBeVisible();
    while ((await this.league(selection.league).count()) === 0) {
      const previous = await this.leagues.count();
      await this.moreLeagues.click();
      await expect(this.leagues).not.toHaveCount(previous);
    }
    await this.league(selection.league).click();
  }

  /** The Team named `name` in the list of the picked Liga's Teams. */
  public team(name: string): Locator {
    return this.teams.filter({
      has: this.page.getByText(name, { exact: true }),
    });
  }
}
