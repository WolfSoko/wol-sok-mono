import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import type { GamePage } from './pos/game.page';
import type { StartPage } from './pos/start.page';
import { withAppearance } from './appearance';
import { expect, test } from './fixtures/pages.fixture';

/** In the fixtures, MTV Wasbüttel's Team, and one of its Spiele the fake DBB has the details of. */
const TEAM = 313036;
const TEAM_GAME = 2861436;

/** The card of the Team, once it shows the Team's Spiele, not its loading state. */
async function cardLoaded(startPage: StartPage): Promise<Locator> {
  const card = startPage.team('MTV Wasbüttel');
  await expect(startPage.lastResult(card)).toBeVisible();
  return card;
}

/** The Spiel page, once its Spielbericht's Kader are there too. */
async function gameLoaded(gamePage: GamePage): Promise<void> {
  await expect(gamePage.result).toBeVisible();
  await expect(gamePage.roster.first()).toBeVisible();
}

/** What axe finds wrong with the contrast of text on the page. */
async function contrastErrors(page: Page): Promise<string[]> {
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

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`contrast (${scheme})`, () => {
    // the look chosen in the settings (#2925), on a device set to the other
    // scheme, so the switch, not the device, decides what axe reads
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({
        colorScheme: scheme === 'light' ? 'dark' : 'light',
      });
      await withAppearance(page, scheme);
    });

    test("keeps every text readable in the app's own colours", async ({
      page,
      startPage,
      searchPage,
      teamPage,
      gamePage,
    }) => {
      await teamPage.goto(TEAM);
      await expect(teamPage.heading).toHaveText('MTV Wasbüttel');
      expect(await contrastErrors(page)).toEqual([]);

      await teamPage.follow.click();
      await startPage.goto();
      await cardLoaded(startPage);
      expect(await contrastErrors(page)).toEqual([]);

      await gamePage.goto(TEAM_GAME);
      await gameLoaded(gamePage);
      expect(await contrastErrors(page)).toEqual([]);

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
      expect(await contrastErrors(page)).toEqual([]);

      // the followed Team's way on to marking the Kind
      await searchPage.gotoChildClub(1837);
      await expect(
        searchPage.markChild(
          teamPage.clubTeam('Regionsliga Braunschweig mu12'),
          'MTV Wasbüttel -RST-'
        )
      ).toBeVisible();
      expect(await contrastErrors(page)).toEqual([]);
    });

    for (const color of ['Gelb', 'Marine', 'Weiß']) {
      test(`keeps every text readable in a Verein's ${color}`, async ({
        page,
        startPage,
        teamPage,
        gamePage,
      }) => {
        await teamPage.goto(TEAM);
        await expect(teamPage.heading).toHaveText('MTV Wasbüttel');
        await teamPage.follow.click();
        await teamPage.chooseClubColors(color);
        await expect(teamPage.clubColorsSheet).toBeHidden();
        expect(await contrastErrors(page)).toEqual([]);

        const clubColor = await teamPage.lineColor();

        await startPage.goto();
        const card = await cardLoaded(startPage);
        // the card wears the Verein's colours before axe looks
        await expect.poll(() => startPage.wearsClubColors(card)).toBe(true);
        expect(await contrastErrors(page)).toEqual([]);

        // one of the followed Team's own Spiele: the page wears its colours
        await gamePage.goto(TEAM_GAME);
        await gameLoaded(gamePage);
        await expect.poll(() => gamePage.lineColor()).toBe(clubColor);
        expect(await contrastErrors(page)).toEqual([]);
      });
    }
  });
}
