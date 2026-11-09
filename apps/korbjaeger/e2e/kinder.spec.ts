import { expect, test } from './fixtures/pages.fixture';

/**
 * In the fixtures, MTV Wasbüttel beat MTV Gifhorn 78:47 on 20 September
 * 2026 (Spiel 2861436), with Fenja Ahornwiese, an invented name, on its
 * Kader.
 */
const MTV_WASBUETTEL = 313036;
const SPIEL = 2861436;
const HEIM = 'MTV Wasbüttel -RST-';
const GAST = 'MTV Gifhorn';
const KIND = 'Fenja Ahornwiese';

test.describe('Kinder', () => {
  test.beforeEach(async ({ page }) => {
    // the day after that Spiel: it is the Team's last result
    await page.clock.setFixedTime(new Date('2026-09-21T12:00:00+02:00'));
  });

  test("a Kind marked in a followed Team's Kader shows on the overview, on its Kader", async ({
    page,
    spielPage,
    startPage,
    teamPage,
  }) => {
    await teamPage.goto(MTV_WASBUETTEL);
    await teamPage.folgen.click();
    await expect(teamPage.nichtMehrFolgen).toBeVisible();

    await spielPage.goto(SPIEL);
    const heim = spielPage.kaderVon(HEIM);
    // only the followed Team's named players can be marked
    await expect(
      spielPage
        .spielerNamens(heim, 'Anonymer Spieler')
        .getByRole('button', { name: 'Als mein Kind markieren' })
    ).toHaveCount(0);
    await expect(
      spielPage
        .kaderVon(GAST)
        .getByRole('button', { name: 'Als mein Kind markieren' })
    ).toHaveCount(0);

    await spielPage.alsKindMarkieren(heim, KIND, 'Fenni');
    const zeile = spielPage.spielerNamens(heim, KIND);
    await expect(zeile).toContainText('„Fenni“');
    await expect(
      zeile.getByRole('button', {
        name: `Mein Kind ${KIND}: Markierung ändern`,
      })
    ).toBeVisible();

    await page.getByRole('link', { name: 'Korbjäger' }).click();
    const kind = startPage.kind('Fenni');
    await expect(kind).toHaveCount(1);
    await expect(startPage.kindTeams(kind)).toHaveText('MTV Wasbüttel');
    await expect(startPage.letztesErgebnis(kind)).toContainText('78:47');
    await expect(startPage.kaderFlagge(kind)).toContainText('Im Kader');
    // the Team shows with its Kind, not again below
    await expect(startPage.teams).toHaveCount(0);

    await page.reload();
    await expect(startPage.kaderFlagge(startPage.kind('Fenni'))).toContainText(
      'Im Kader'
    );
  });
});
