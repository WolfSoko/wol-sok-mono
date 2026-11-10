import { expect, test } from './fixtures/pages.fixture';
import type { IndexedClubAnswer } from './pos/suche.page';

const NIEDERSACHSEN = { id: 7, name: 'Niedersachsen' };
/** In the fixtures, the Verein of MTV Wasbüttel's Team 313036. */
const WASBUETTEL: IndexedClubAnswer = {
  id: 1837,
  name: 'MTV Wasbüttel',
  associations: [NIEDERSACHSEN],
};
const GIFHORN: IndexedClubAnswer = {
  id: 1835,
  name: 'MTV Gifhorn',
  associations: [NIEDERSACHSEN],
};
const TEAM = 313036;

test.describe('Suchen', () => {
  test.beforeEach(async ({ page, suchePage }) => {
    // the day after MTV Wasbüttel's last Spiel in the fixtures
    await page.clock.setFixedTime(new Date('2026-11-09T12:00:00+01:00'));
    await suchePage.clubIndex([GIFHORN, WASBUETTEL]);
  });

  test('an Elternteil finds the Verein by its name and follows its Team', async ({
    page,
    startPage,
    suchePage,
    titleBar,
  }) => {
    await startPage.goto();
    await titleBar.search.click();
    await expect(page).toHaveURL(/\/suchen$/);
    await expect(suchePage.heading).toHaveText('Suchen');
    await expect(titleBar.levels).toHaveText(['Korbjäger', 'Suchen']);

    await suchePage.vereinssuche.fill('wasbuttel');
    await expect(suchePage.status).toHaveText('Ein Verein gefunden.');
    await suchePage.vereine.filter({ hasText: 'MTV Wasbüttel' }).click();

    await expect(page).toHaveURL(/\/suchen\/verein\/1837$/);
    await expect(suchePage.heading).toHaveText('MTV Wasbüttel');
    await expect(titleBar.levels).toHaveText([
      'Korbjäger',
      'Suchen',
      'MTV Wasbüttel',
    ]);
    await suchePage
      .team(TEAM)
      .getByRole('button', { name: /^Team folgen/ })
      .click();
    await expect(
      suchePage.team(TEAM).getByRole('button', { name: /^Nicht mehr folgen/ })
    ).toBeVisible();

    await titleBar.back.click();
    await expect(page).toHaveURL(/\/suchen$/);
    // the term is still there, so the Elternteil picks the next match
    await expect(suchePage.vereinssuche).toHaveValue('wasbuttel');

    await titleBar.level('Korbjäger').click();
    await expect(startPage.team('MTV Wasbüttel')).toHaveCount(1);
  });

  test('never sends the typed text anywhere', async ({ page, suchePage }) => {
    const urls: string[] = [];
    page.on('request', (request) => urls.push(request.url()));
    await suchePage.goto();

    await suchePage.vereinssuche.fill('gifhorn');
    await expect(suchePage.vereine).toHaveText([/MTV Gifhorn/]);

    expect(urls.filter((url) => url.toLowerCase().includes('gifhorn'))).toEqual(
      []
    );
  });

  for (const [pfad, titel] of [
    ['/suchen', 'Suchen'],
    ['/suchen/verein/1837', 'MTV Wasbüttel'],
  ] as const) {
    test(`${pfad} opens directly and is noindex`, async ({ page }) => {
      await page.goto(pfad);

      await expect(page.getByRole('heading', { level: 1 })).toHaveText(titel);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        'content',
        /noindex/
      );
    });
  }
});
