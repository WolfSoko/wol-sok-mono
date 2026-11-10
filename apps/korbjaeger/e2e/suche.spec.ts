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

test.describe('Suche', () => {
  test.beforeEach(async ({ page }) => {
    // the day after MTV Wasbüttel's last Spiel in the fixtures
    await page.clock.setFixedTime(new Date('2026-11-08T12:00:00+01:00'));
  });

  test("an Elternteil finds the Verein by its name and follows its child's Team", async ({
    page,
    startPage,
    suchenPage: suche,
    teamPage,
    titleBar,
  }) => {
    const index = await clubIndex(page, CLUB_INDEX);
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));

    await startPage.goto();
    await titleBar.search.click();
    await expect(page).toHaveURL(/\/suchen$/);
    await expect(suche.heading).toHaveText('Team suchen');
    await expect(titleBar.levels).toHaveText(['Korbjäger', 'Suchen']);

    await suche.vereinssuche.fill('wasbuttel');
    await expect(suche.vereine).toHaveCount(1);
    await suche.verein('MTV Wasbüttel').click();

    await expect(page).toHaveURL(/\/suchen\/verein\/1837$/);
    await expect(suche.heading).toHaveText('MTV Wasbüttel');
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
    await expect(suche.vereinssuche).toHaveValue('wasbuttel');
    await expect(suche.vereine).toHaveCount(1);

    await titleBar.level('Korbjäger').click();
    await expect(startPage.teams).toHaveCount(1);

    expect(index.calls()).toBe(1);
    expect(requests.filter((url) => url.includes('wasbuttel'))).toEqual([]);
  });

  test('opens the Liga wizard below the search', async ({
    page,
    startPage,
    suchenPage: suche,
    teamEinrichtenPage: wizard,
    titleBar,
  }) => {
    await clubIndex(page, CLUB_INDEX);

    await startPage.goto();
    await startPage.teamSuchen.click();
    await suche.ueberLiga.click();

    await expect(page).toHaveURL(/\/team-einrichten$/);
    await expect(wizard.heading).toHaveText('Team einrichten');
    await expect(titleBar.levels).toHaveText([
      'Korbjäger',
      'Suchen',
      'Team einrichten',
    ]);
  });

  test('says so where no Verein matches, and while the list is being built', async ({
    page,
    suchenPage: suche,
  }) => {
    await clubIndex(page, CLUB_INDEX);
    await suche.goto();

    await suche.vereinssuche.fill('bamberg');
    await expect(suche.keinTreffer).toContainText('Kein Verein gefunden');

    await page.unroute('**/api/clubs');
    await clubIndex(page, []);
    await page.reload();
    await expect(suche.leer).toContainText('wird gerade aufgebaut');
  });

  test('says the DBB is not reachable, and loads again when asked', async ({
    page,
    suchenPage: suche,
  }) => {
    await clubIndex(page, { error: 'club-index-unavailable' }, 502);
    await suche.goto();
    await expect(suche.fehler).toContainText('nicht erreichbar');

    await page.unroute('**/api/clubs');
    await clubIndex(page, CLUB_INDEX);
    await suche.fehler
      .getByRole('button', { name: 'Erneut versuchen' })
      .click();
    await suche.vereinssuche.fill('post');

    await expect(suche.fehler).toBeHidden();
    await expect(suche.verein('Post SV Nürnberg')).toHaveCount(1);
  });

  for (const pfad of ['/suchen', '/suchen/verein/1837']) {
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
