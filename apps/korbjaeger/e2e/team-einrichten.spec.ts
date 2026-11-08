import { expect, test } from './fixtures/pages.fixture';

test.describe('Team einrichten', () => {
  test.beforeEach(async ({ page }) => {
    // the day after MTV Wasbüttel's last Spiel in the fixtures
    await page.clock.setFixedTime(new Date('2026-11-09T12:00:00+01:00'));
  });

  test('an Elternteil without ids finds the Team through its Liga and follows it', async ({
    page,
    startPage,
    teamEinrichtenPage: wizard,
    teamPage,
  }) => {
    await startPage.goto();
    await startPage.teamEinrichten.click();
    await expect(wizard.heading).toHaveText('Team einrichten');

    await wizard.waehlen('Verband', 'Niedersachsen');
    await wizard.waehlen('Altersklasse', 'U12');
    await wizard.waehlen('Geschlecht', 'Jugend männlich');
    await expect(wizard.ligen).toHaveCount(10);
    await expect(
      wizard.liga('Regionsvorrunde Nord Braunschweig mu12')
    ).toHaveCount(0);

    await wizard.weitereLigen.click();
    await expect(wizard.ligen).toHaveCount(20);
    await wizard.liga('Regionsvorrunde Nord Braunschweig mu12').click();

    await expect(wizard.teams).toHaveCount(6);
    await expect(wizard.team('MTV Gifhorn')).toHaveCount(1);
    await wizard.team('MTV Wasbüttel -RST-').click();

    await expect(page).toHaveURL(/\/team\/313036$/);
    await expect(teamPage.heading).toHaveText('MTV Wasbüttel');
    await expect(teamPage.folgen).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('link', { name: 'Korbjäger' }).click();
    await expect(startPage.teams).toHaveCount(1);
    await expect(startPage.team('MTV Wasbüttel')).toHaveCount(1);
    await expect(startPage.teamEinrichten).toHaveCount(0);
  });
});
