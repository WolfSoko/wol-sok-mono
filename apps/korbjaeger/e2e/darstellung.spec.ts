import { expect, test } from './fixtures/pages.fixture';
import { hatDunklenHintergrund } from './darstellung';

/** In the fixtures, MTV Wasbüttel plays its last Spiel on 8 November 2026. */
const MTV_WASBUETTEL = 313036;

/** The app's own scripts; blocked, only the script in index.html runs. */
const APP_SKRIPTE = /\.m?js(\?.*)?$/;

// the service worker would answer the reload from its cache, past `route`
test.use({ serviceWorkers: 'block' });

test.describe('Darstellung', () => {
  for (const { name, wahl, geraet } of [
    { name: 'Dunkel', wahl: 'dark', geraet: 'light' },
    { name: 'Hell', wahl: 'light', geraet: 'dark' },
  ] as const) {
    test(`"${name}" holds after a reload, before the app's scripts run`, async ({
      page,
      einstellungenPage,
    }) => {
      await page.emulateMedia({ colorScheme: geraet });
      await einstellungenPage.goto();
      await expect(einstellungenPage.darstellung('System')).toBeChecked();

      await einstellungenPage.darstellung(name).click();
      await expect(einstellungenPage.darstellung(name)).toBeChecked();
      await expect(page.locator('html')).toHaveAttribute('data-theme', wahl);

      // only the script in index.html may set the look now: no flash of the
      // device's look while the app loads
      await page.route(APP_SKRIPTE, (route) => route.abort());
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', wahl);
      expect(await hatDunklenHintergrund(page.locator('body'))).toBe(
        wahl === 'dark'
      );
    });
  }

  test('"System" follows the device live, without a reload', async ({
    page,
    einstellungenPage,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await einstellungenPage.goto();
    await einstellungenPage.darstellung('Dunkel').click();
    await einstellungenPage.darstellung('System').click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);
    const body = page.locator('body');
    expect(await hatDunklenHintergrund(body)).toBe(false);

    await page.emulateMedia({ colorScheme: 'dark' });
    await expect.poll(() => hatDunklenHintergrund(body)).toBe(true);

    await page.emulateMedia({ colorScheme: 'light' });
    await expect.poll(() => hatDunklenHintergrund(body)).toBe(false);
  });

  test('the scoreboard stays dark in every look', async ({
    page,
    einstellungenPage,
    startPage,
    teamPage,
  }) => {
    // the day after the Team's last Spiel: its result is on the scoreboard
    await page.clock.setFixedTime(new Date('2026-11-09T12:00:00+01:00'));
    await page.emulateMedia({ colorScheme: 'light' });
    await teamPage.goto(MTV_WASBUETTEL);
    await teamPage.folgen.click();

    for (const name of ['System', 'Hell', 'Dunkel'] as const) {
      await einstellungenPage.goto();
      await einstellungenPage.darstellung(name).click();
      await startPage.goto();
      const tafel = startPage
        .team('MTV Wasbüttel')
        .locator('.anzeigetafel')
        .first();
      await expect(tafel).toBeVisible();
      await expect(tafel).toHaveCSS('color-scheme', 'dark');
      expect(await hatDunklenHintergrund(tafel)).toBe(true);
    }
  });
});
