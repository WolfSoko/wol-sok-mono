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
    await wizard.goto();
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
    await expect(teamPage.nichtMehrFolgen).toBeVisible();

    await page.getByRole('link', { name: 'Korbjäger' }).click();
    await expect(startPage.teams).toHaveCount(1);
    await expect(startPage.team('MTV Wasbüttel')).toHaveCount(1);
    await expect(startPage.searchTeam).toHaveCount(0);
  });

  test('unfollows a Team from its row in the wizard', async ({
    page,
    startPage,
    teamEinrichtenPage: wizard,
    teamPage,
  }) => {
    await teamPage.goto(313036);
    await teamPage.folgen.click();
    await expect(teamPage.nichtMehrFolgen).toBeVisible();

    await wizard.goto();
    await wizard.ligaOeffnen({
      verband: 'Niedersachsen',
      altersklasse: 'U12',
      geschlecht: 'Jugend männlich',
      liga: 'Regionsvorrunde Nord Braunschweig mu12',
    });
    await expect(wizard.team('MTV Wasbüttel -RST-')).toContainText('Gefolgt');

    await wizard.nichtMehrFolgen('MTV Wasbüttel -RST-').click();
    await expect(wizard.team('MTV Wasbüttel -RST-')).not.toContainText(
      'Gefolgt'
    );
    await expect(page).toHaveURL(/\/team-einrichten$/);

    await page.reload();
    await startPage.goto();
    await expect(startPage.leer).toBeVisible();
  });
});
