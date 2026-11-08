import type { Locator, Page } from '@playwright/test';

/** One Spiel in the Team page's list. */
export interface SpielEintrag {
  readonly datum: string;
  readonly ort: string;
  readonly gegner: string;
  readonly liga: string;
  readonly ergebnis?: string;
}

/** `/team/{id}`: a Team's Spiele of the Saison. */
export class TeamPage {
  public readonly heading: Locator;
  public readonly spiele: Locator;

  public constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.spiele = page.getByTestId('spiel');
  }

  public async goto(teamId: number): Promise<void> {
    await this.page.goto(`/team/${teamId}`);
  }

  /** Every Spiel as listed, top to bottom. */
  public async eintraege(): Promise<readonly SpielEintrag[]> {
    const zeilen = await this.spiele.all();
    return Promise.all(zeilen.map((zeile) => eintrag(zeile)));
  }
}

async function eintrag(zeile: Locator): Promise<SpielEintrag> {
  const text = (name: string): Promise<string> =>
    zeile.getByTestId(`spiel-${name}`).innerText();
  const ergebnis = zeile.getByTestId('spiel-ergebnis');
  return {
    datum: await text('datum'),
    ort: await text('ort'),
    gegner: await text('gegner'),
    liga: await text('liga'),
    ...((await ergebnis.count()) > 0
      ? { ergebnis: await ergebnis.innerText() }
      : {}),
  };
}
