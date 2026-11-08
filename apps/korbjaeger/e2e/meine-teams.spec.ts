import { expect, test } from './fixtures/pages.fixture';

/** In the fixtures, MTV Wasbüttel's last Spiel is on 8 November 2026. */
const MTV_WASBUETTEL = 313036;

test.describe('Meine Teams', () => {
  test.beforeEach(async ({ page }) => {
    // a week before the Team's last Spiel in the fixtures
    await page.clock.setFixedTime(new Date('2026-11-01T12:00:00+01:00'));
  });

  test('a Team followed on its page shows on the overview, after a reload too', async ({
    page,
    startPage,
    teamPage,
  }) => {
    await startPage.goto();
    await expect(startPage.leer).toBeVisible();

    await teamPage.goto(MTV_WASBUETTEL);
    await expect(teamPage.folgen).toHaveAttribute('aria-pressed', 'false');
    await teamPage.folgen.click();
    await expect(teamPage.folgen).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('link', { name: 'Korbjäger' }).click();
    const team = startPage.team('MTV Wasbüttel');
    await expect(startPage.teams).toHaveCount(1);
    await expect(startPage.naechstesSpiel(team)).toContainText(
      'So., 08.11.2026 · 09:00 Uhr'
    );
    await expect(startPage.naechstesSpiel(team)).toContainText(
      'Heim gegen TV Jahn Wolfsburg Honeybadgers -RST-'
    );
    await expect(startPage.letztesErgebnis(team)).toContainText(
      'Auswärts gegen SV Groß Oesingen -RST-'
    );
    await expect(startPage.letztesErgebnis(team)).toContainText('30:111');

    await page.reload();
    await expect(startPage.teams).toHaveCount(1);
    await expect(startPage.naechstesSpiel(team)).toContainText(
      'So., 08.11.2026'
    );

    await team.getByRole('link', { name: 'MTV Wasbüttel' }).click();
    await expect(teamPage.heading).toHaveText('MTV Wasbüttel');
    await teamPage.folgen.click();
    await startPage.goto();
    await expect(startPage.leer).toBeVisible();
  });
});
