import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/pages.fixture';
import { folgenKnopf } from './pos/folgen';

/**
 * The club index as `/api/clubs` serves it. The e2e's server reads no
 * Firestore, so the spec answers it; the Verein's Teams come from the
 * fake DBB (MTV Wasbüttel is Verein 1837 in the fixtures).
 */
const CLUB_INDEX = [
  {
    id: 1837,
    name: 'MTV Wasbüttel',
    associations: [{ id: 7, name: 'Niedersachsen' }],
  },
  {
    id: 1476,
    name: 'Post SV Nürnberg',
    associations: [{ id: 2, name: 'Bayern' }],
  },
];

/** Answers `/api/clubs` with `body` and `status`; counts the calls made. */
async function clubIndex(
  page: Page,
  body: unknown,
  status = 200
): Promise<{ calls: () => number }> {
  let calls = 0;
  await page.route('**/api/clubs', (route) => {
    calls += 1;
    return route.fulfill({ status, json: body });
  });
  return { calls: () => calls };
}

test.describe('Search', () => {
  test.beforeEach(async ({ page }) => {
    // the day after MTV Wasbüttel's last Spiel in the fixtures
    await page.clock.setFixedTime(new Date('2026-11-08T12:00:00+01:00'));
  });

  test("an Elternteil finds the Verein by its name and follows its child's Team", async ({
    page,
    startPage,
    searchPage: search,
    teamPage,
    titleBar,
  }) => {
    const index = await clubIndex(page, CLUB_INDEX);
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));

    await startPage.goto();
    await titleBar.search.click();
    await expect(page).toHaveURL(/\/suchen$/);
    await expect(search.heading).toHaveText('Team suchen');
    await expect(titleBar.levels).toHaveText(['Korbjäger', 'Suchen']);

    await search.clubSearch.fill('wasbuttel');
    await expect(search.clubs).toHaveCount(1);
    await search.club('MTV Wasbüttel').click();

    await expect(page).toHaveURL(/\/suchen\/verein\/1837$/);
    await expect(search.heading).toHaveText('MTV Wasbüttel');
    await expect(titleBar.levels).toHaveText([
      'Korbjäger',
      'Suchen',
      'MTV Wasbüttel',
    ]);
    const team = teamPage.vereinsTeam('Regionsliga Braunschweig mu10');
    await folgenKnopf(team, 'MTV Wasbüttel -RST-', { gefolgt: false }).click();
    await expect(
      folgenKnopf(team, 'MTV Wasbüttel -RST-', { gefolgt: true })
    ).toBeVisible();

    await titleBar.back.click();
    await expect(page).toHaveURL(/\/suchen$/);
    await expect(search.clubSearch).toHaveValue('wasbuttel');
    await expect(search.clubs).toHaveCount(1);

    await titleBar.level('Korbjäger').click();
    await expect(startPage.teams).toHaveCount(1);

    expect(index.calls()).toBe(1);
    expect(requests.filter((url) => url.includes('wasbuttel'))).toEqual([]);
  });

  test("an Elternteil finds the Verein, follows the Kind's Team and marks the Kind in its Kader", async ({
    page,
    startPage,
    searchPage: search,
    spielPage,
    teamPage,
    titleBar,
  }) => {
    // the day after Spiel 2861436, the Team's last played one then, whose
    // Kader names Fenja Ahornwiese (an invented name)
    await page.clock.setFixedTime(new Date('2026-09-21T12:00:00+02:00'));
    await clubIndex(page, CLUB_INDEX);
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));

    await search.goto();
    await search.byChild.click();
    await expect(page).toHaveURL(/\/suchen\/kind$/);
    await expect(search.heading).toHaveText('Über mein Kind');
    await expect(titleBar.levels).toHaveText([
      'Korbjäger',
      'Suchen',
      'Mein Kind',
    ]);

    await search.clubSearch.fill('wasbuttel');
    await search.club('MTV Wasbüttel').click();
    await expect(page).toHaveURL(/\/suchen\/kind\/verein\/1837$/);
    await expect(titleBar.levels).toHaveText([
      'Korbjäger',
      'Suchen',
      'Mein Kind',
      'MTV Wasbüttel',
    ]);
    await expect(search.followFirst).toBeVisible();

    const teamName = 'MTV Wasbüttel -RST-';
    const team = teamPage.vereinsTeam('Regionsliga Braunschweig mu12');
    await expect(search.markChild(team, teamName)).toHaveCount(0);
    await folgenKnopf(team, teamName, { gefolgt: false }).click();
    await search.markChild(team, teamName).click();

    await expect(page).toHaveURL(/\/spiel\/2861436$/);
    await spielPage.alsKindMarkieren(
      spielPage.kaderVon(teamName),
      'Fenja Ahornwiese',
      'Fenni'
    );

    await titleBar.level('Korbjäger').click();
    await expect(startPage.kind('Fenni')).toHaveCount(1);
    expect(requests.filter((url) => url.includes('wasbuttel'))).toEqual([]);
  });

  test('opens the Liga wizard below the search', async ({
    page,
    startPage,
    searchPage: search,
    teamEinrichtenPage: wizard,
    titleBar,
  }) => {
    const index = await clubIndex(page, CLUB_INDEX);

    await startPage.goto();
    await startPage.searchTeam.click();
    await search.byLeague.click();

    await expect(page).toHaveURL(/\/team-einrichten$/);
    await expect(wizard.heading).toHaveText('Team einrichten');
    await expect(titleBar.levels).toHaveText([
      'Korbjäger',
      'Suchen',
      'Team einrichten',
    ]);
    // the club list loads only once the search is used
    expect(index.calls()).toBe(0);
  });

  test('says so where no Verein matches, and while the list is being built', async ({
    page,
    searchPage: search,
  }) => {
    await clubIndex(page, CLUB_INDEX);
    await search.goto();

    await search.clubSearch.fill('bamberg');
    await expect(search.noHits).toContainText('Kein Verein gefunden');

    await page.unroute('**/api/clubs');
    await clubIndex(page, []);
    await page.reload();
    await search.clubSearch.focus();
    await expect(search.empty).toContainText('wird gerade aufgebaut');
  });

  test('says the club list is not reachable, and loads again when asked', async ({
    page,
    searchPage: search,
  }) => {
    await clubIndex(page, { error: 'club-index-unavailable' }, 502);
    await search.goto();
    await search.clubSearch.focus();
    await expect(search.failure).toContainText(
      'Die Vereinsliste ist gerade nicht erreichbar'
    );

    await page.unroute('**/api/clubs');
    await clubIndex(page, CLUB_INDEX);
    await search.failure
      .getByRole('button', { name: 'Erneut versuchen' })
      .click();
    await search.clubSearch.fill('post');

    await expect(search.failure).toBeHidden();
    await expect(search.club('Post SV Nürnberg')).toHaveCount(1);
  });

  for (const pfad of [
    '/suchen',
    '/suchen/verein/1837',
    '/suchen/kind',
    '/suchen/kind/verein/1837',
  ]) {
    test(`${pfad} opens directly and is noindex`, async ({ page }) => {
      await clubIndex(page, CLUB_INDEX);
      await page.goto(pfad);

      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        'content',
        'noindex'
      );
    });
  }
});
