import { expect, test } from './fixtures/pages.fixture';

/** In the fixtures, MTV Wasbüttel's last Spiel is on 8 November 2026. */
const MTV_WASBUETTEL = 313036;

test.describe('Meine Teams', () => {
  test.beforeEach(async ({ page }) => {
    // the day after the Team's last Spiel in the fixtures: all are played,
    // so the overview shows the last result only
    await page.clock.setFixedTime(new Date('2026-11-09T12:00:00+01:00'));
  });

  test('a Team followed on its page shows on the overview, after a reload too', async ({
    page,
    startPage,
    teamPage,
  }) => {
    await startPage.goto();
    await expect(startPage.leer).toBeVisible();

    await teamPage.goto(MTV_WASBUETTEL);
    await expect(teamPage.folgen).toBeVisible();
    await teamPage.folgen.click();
    await expect(teamPage.nichtMehrFolgen).toBeVisible();

    await page.getByRole('link', { name: 'Korbjäger' }).click();
    const team = startPage.team('MTV Wasbüttel');
    await expect(startPage.teams).toHaveCount(1);
    await expect(startPage.naechstesSpiel(team)).toHaveCount(0);
    await expect(startPage.letztesErgebnis(team)).toContainText(
      'So., 08.11.2026 · 09:00 Uhr'
    );
    await expect(startPage.letztesErgebnis(team)).toContainText(
      'Heim gegen TV Jahn Wolfsburg Honeybadgers -RST-'
    );
    await expect(startPage.letztesErgebnis(team)).toContainText('58:67');

    await page.reload();
    await expect(startPage.teams).toHaveCount(1);
    await expect(startPage.letztesErgebnis(team)).toContainText('58:67');

    await team.getByRole('link', { name: 'MTV Wasbüttel' }).click();
    await expect(teamPage.heading).toHaveText('MTV Wasbüttel');
    await teamPage.nichtMehrFolgen.click();
    await expect(teamPage.folgen).toBeVisible();
    await page.reload();
    await expect(teamPage.folgen).toBeVisible();
    await startPage.goto();
    await expect(startPage.leer).toBeVisible();
  });

  test('a Team unfollowed from its card is gone, after a reload too, unless undone', async ({
    page,
    startPage,
    teamPage,
  }) => {
    await teamPage.goto(MTV_WASBUETTEL);
    await teamPage.folgen.click();
    await startPage.goto();
    const team = startPage.team('MTV Wasbüttel');
    await expect(startPage.letztesErgebnis(team)).toContainText('58:67');

    await startPage.nichtMehrFolgen(team).click();
    await expect(startPage.leer).toBeVisible();
    await startPage.rueckgaengig.click();
    await expect(startPage.teams).toHaveCount(1);

    await startPage.nichtMehrFolgen(team).click();
    await expect(startPage.leer).toBeVisible();
    await page.reload();
    await expect(startPage.leer).toBeVisible();
  });
});
