import { expect, test } from './fixtures/pages.fixture';

/** In the fixtures, MTV Wasbüttel's Spiele; it beat MTV Gifhorn 78:47. */
const MTV_WASBUETTEL = 313036;

/*
 * The served app is a Vite dev server (`serve-e2e`), where the service
 * worker never registers: a reload offline would fail. So the app stays
 * loaded and navigates within itself once the network is gone; what is
 * checked is the transport's last good data. The service worker serves
 * the app shell of the production build only.
 */
test.describe('Without a network', () => {
  test.beforeEach(async ({ page }) => {
    // the day of the Team's last Spiel in the fixtures
    await page.clock.install({ time: new Date('2026-11-08T12:00:00+01:00') });
  });

  test("shows the Team's last good Spiele with their Stand, and says what it never read", async ({
    context,
    page,
    spielPage,
    startPage,
    teamPage,
  }) => {
    await teamPage.goto(MTV_WASBUETTEL);
    await expect(teamPage.heading).toHaveText('MTV Wasbüttel');
    await expect(teamPage.stand).toBeEmpty();
    await teamPage.folgen.click();
    // the Spiel page once, so its code is loaded before the network goes
    await teamPage.spielGegen('MTV Gifhorn').click();
    await expect(spielPage.heading).toContainText('MTV Gifhorn');
    await page.getByRole('link', { name: 'Korbjäger' }).click();
    await expect(startPage.teams).toHaveCount(1);

    await page.clock.fastForward('02:00:00');
    await context.setOffline(true);
    await startPage
      .team('MTV Wasbüttel')
      .getByTestId('ueberblick-name')
      .click();

    await expect(teamPage.heading).toHaveText('MTV Wasbüttel');
    await expect(teamPage.spiele).toHaveCount(6);
    await expect(teamPage.stand).toHaveText(/Offline · Stand: vor 2 Std\./);

    await teamPage.spielGegen('SV Groß Schwülper').first().click();
    await expect(spielPage.fehler).toHaveText(
      /^Keine Verbindung zum Internet\./
    );
  });
});
