import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import type { SpielPage } from './pos/spiel.page';
import type { StartPage } from './pos/start.page';
import { mitDarstellung } from './darstellung';
import { expect, test } from './fixtures/pages.fixture';

/** In the fixtures, MTV Wasbüttel's Team, and one of its Spiele the fake DBB has the details of. */
const TEAM = 313036;
const SPIEL_DES_TEAMS = 2861436;

/** The card of the Team, once it shows the Team's Spiele, not its loading state. */
async function karteGeladen(startPage: StartPage): Promise<Locator> {
  const karte = startPage.team('MTV Wasbüttel');
  await expect(startPage.letztesErgebnis(karte)).toBeVisible();
  return karte;
}

/** The Spiel page, once its Spielbericht's Kader are there too. */
async function spielGeladen(spielPage: SpielPage): Promise<void> {
  await expect(spielPage.ergebnis).toBeVisible();
  await expect(spielPage.kader.first()).toBeVisible();
}

/** What axe finds wrong with the contrast of text on the page. */
async function kontrastFehler(page: Page): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page })
    .withRules(['color-contrast'])
    .analyze();
  return violations.flatMap(({ nodes }) =>
    nodes.map(
      ({ target, failureSummary }) =>
        `${target.join(' ')}: ${failureSummary ?? ''}`
    )
  );
}

for (const schema of ['light', 'dark'] as const) {
  test.describe(`contrast (${schema})`, () => {
    // the look chosen in the settings (#2925), on a device set to the other
    // scheme, so the switch, not the device, decides what axe reads
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({
        colorScheme: schema === 'light' ? 'dark' : 'light',
      });
      await mitDarstellung(page, schema);
    });

    test("keeps every text readable in the app's own colours", async ({
      page,
      startPage,
      searchPage,
      teamPage,
      spielPage,
    }) => {
      await teamPage.goto(TEAM);
      await expect(teamPage.heading).toHaveText('MTV Wasbüttel');
      expect(await kontrastFehler(page)).toEqual([]);

      await teamPage.folgen.click();
      await startPage.goto();
      await karteGeladen(startPage);
      expect(await kontrastFehler(page)).toEqual([]);

      await spielPage.goto(SPIEL_DES_TEAMS);
      await spielGeladen(spielPage);
      expect(await kontrastFehler(page)).toEqual([]);

      await page.route('**/api/clubs', (route) =>
        route.fulfill({
          json: [
            {
              id: 1837,
              name: 'MTV Wasbüttel',
              associations: [{ id: 7, name: 'Niedersachsen' }],
            },
          ],
        })
      );
      await searchPage.goto();
      await searchPage.clubSearch.fill('wasbuttel');
      await expect(searchPage.clubs).toHaveCount(1);
      expect(await kontrastFehler(page)).toEqual([]);

      // the followed Team's way on to marking the Kind
      await searchPage.gotoChildClub(1837);
      await expect(
        searchPage.markChild(
          teamPage.vereinsTeam('Regionsliga Braunschweig mu12'),
          'MTV Wasbüttel -RST-'
        )
      ).toBeVisible();
      expect(await kontrastFehler(page)).toEqual([]);
    });

    for (const farbe of ['Gelb', 'Marine', 'Weiß']) {
      test(`keeps every text readable in a Verein's ${farbe}`, async ({
        page,
        startPage,
        teamPage,
        spielPage,
      }) => {
        await teamPage.goto(TEAM);
        await expect(teamPage.heading).toHaveText('MTV Wasbüttel');
        await teamPage.folgen.click();
        await teamPage.vereinsfarbenWaehlen(farbe);
        await expect(teamPage.vereinsfarbenBlatt).toBeHidden();
        expect(await kontrastFehler(page)).toEqual([]);

        const vereinsfarbe = await teamPage.linienfarbe();

        await startPage.goto();
        const karte = await karteGeladen(startPage);
        // the card wears the Verein's colours before axe looks
        await expect
          .poll(() => startPage.traegtVereinsfarben(karte))
          .toBe(true);
        expect(await kontrastFehler(page)).toEqual([]);

        // one of the followed Team's own Spiele: the page wears its colours
        await spielPage.goto(SPIEL_DES_TEAMS);
        await spielGeladen(spielPage);
        await expect.poll(() => spielPage.linienfarbe()).toBe(vereinsfarbe);
        expect(await kontrastFehler(page)).toEqual([]);
      });
    }
  });
}
