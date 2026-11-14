import { expect, test } from './fixtures/pages.fixture';

/**
 * In the fixtures, MTV Wasbüttel beat MTV Gifhorn 78:47 on 20 September
 * 2026 (Spiel 2861436), with Fenja Ahornwiese, an invented name, on its
 * Kader.
 */
const MTV_WASBUETTEL = 313036;
const GAME = 2861436;
const HOME = 'MTV Wasbüttel -RST-';
const AWAY = 'MTV Gifhorn';
const CHILD = 'Fenja Ahornwiese';

test.describe('Kinder', () => {
  test.beforeEach(async ({ page }) => {
    // the day after that Spiel: it is the Team's last result
    await page.clock.setFixedTime(new Date('2026-09-21T12:00:00+02:00'));
  });

  test("a Kind marked in a followed Team's Kader shows on the overview, on its Kader", async ({
    page,
    gamePage,
    startPage,
    teamPage,
  }) => {
    await teamPage.goto(MTV_WASBUETTEL);
    await teamPage.follow.click();
    await expect(teamPage.unfollow).toBeVisible();

    await gamePage.goto(GAME);
    const home = gamePage.rosterOf(HOME);
    // only the followed Team's named players can be marked
    await expect(
      gamePage
        .playerNamed(home, 'Anonymer Spieler')
        .getByRole('button', { name: 'Als mein Kind markieren' })
    ).toHaveCount(0);
    await expect(
      gamePage
        .rosterOf(AWAY)
        .getByRole('button', { name: 'Als mein Kind markieren' })
    ).toHaveCount(0);

    await gamePage.markAsChild(home, CHILD, 'Fenni');
    const row = gamePage.playerNamed(home, CHILD);
    await expect(row).toContainText('„Fenni“');
    await expect(
      row.getByRole('button', {
        name: `Mein Kind ${CHILD}: Markierung ändern`,
      })
    ).toBeVisible();

    await page.getByRole('link', { name: 'Korbjäger' }).click();
    const child = startPage.child('Fenni');
    await expect(child).toHaveCount(1);
    await expect(startPage.childTeams(child)).toHaveText('MTV Wasbüttel');
    await expect(startPage.lastResult(child)).toContainText('78:47');
    await expect(startPage.rosterFlag(child)).toContainText('Im Kader');
    // the Team shows with its Kind, not again below
    await expect(startPage.teams).toHaveCount(0);

    await page.reload();
    await expect(startPage.rosterFlag(startPage.child('Fenni'))).toContainText(
      'Im Kader'
    );
  });
});
