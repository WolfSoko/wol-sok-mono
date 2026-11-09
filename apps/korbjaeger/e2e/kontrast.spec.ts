import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/pages.fixture';

/** In the fixtures, MTV Wasbüttel's Team, and one of its Spiele the fake DBB has the details of. */
const TEAM = 313036;
const SPIEL_DES_TEAMS = 2861436;

/** What axe finds wrong with the contrast of text on the page. */
async function kontrastFehler(page: Page): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page })
    .withRules(['color-contrast'])
    .analyze();
  return violations.flatMap(({ nodes }) =>
    nodes.map(({ target, failureSummary }) => `${target}: ${failureSummary}`)
  );
}

for (const schema of ['light', 'dark'] as const) {
  test.describe(`contrast (${schema})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: schema });
    });

    test("keeps every text readable in the app's own colours", async ({
      page,
      startPage,
      teamPage,
      spielPage,
    }) => {
      await teamPage.goto(TEAM);
      await expect(teamPage.heading).toHaveText('MTV Wasbüttel');
      expect(await kontrastFehler(page)).toEqual([]);

      await teamPage.folgen.click();
      await startPage.goto();
      await expect(page.getByTestId('ueberblick-team')).toHaveCount(1);
      expect(await kontrastFehler(page)).toEqual([]);

      await spielPage.goto(SPIEL_DES_TEAMS);
      await expect(spielPage.ergebnis).toBeVisible();
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
        await expect(page.getByTestId('ueberblick-team')).toHaveCount(1);
        expect(await kontrastFehler(page)).toEqual([]);

        // one of the followed Team's own Spiele: the page wears its colours
        await spielPage.goto(SPIEL_DES_TEAMS);
        await expect(spielPage.ergebnis).toBeVisible();
        await expect
          .poll(() =>
            page
              .getByRole('heading', { level: 1 })
              .evaluate((h1) => getComputedStyle(h1).borderBlockEndColor)
          )
          .toBe(vereinsfarbe);
        expect(await kontrastFehler(page)).toEqual([]);
      });
    }
  });
}
