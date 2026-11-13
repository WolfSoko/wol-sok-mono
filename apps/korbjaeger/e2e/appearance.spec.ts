import { expect, test } from './fixtures/pages.fixture';
import { hasDarkBackground } from './appearance';

/** In the fixtures, MTV Wasbüttel plays its last Spiel on 8 November 2026. */
const MTV_WASBUETTEL = 313036;

/** The app's own scripts; blocked, only the script in index.html runs. */
const APP_SCRIPTS = /\.m?js(\?.*)?$/;

// the service worker would answer the reload from its cache, past `route`
test.use({ serviceWorkers: 'block' });

test.describe('Darstellung', () => {
  for (const { name, choice, device } of [
    { name: 'Dunkel', choice: 'dark', device: 'light' },
    { name: 'Hell', choice: 'light', device: 'dark' },
  ] as const) {
    test(`"${name}" holds after a reload, before the app's scripts run`, async ({
      page,
      settingsPage,
    }) => {
      await page.emulateMedia({ colorScheme: device });
      await settingsPage.goto();
      await expect(settingsPage.appearance('System')).toBeChecked();

      await settingsPage.appearance(name).click();
      await expect(settingsPage.appearance(name)).toBeChecked();
      await expect(page.locator('html')).toHaveAttribute('data-theme', choice);

      // only the script in index.html may set the look now: no flash of the
      // device's look while the app loads
      await page.route(APP_SCRIPTS, (route) => route.abort());
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', choice);
      expect(await hasDarkBackground(page.locator('body'))).toBe(
        choice === 'dark'
      );
    });
  }

  test('"System" follows the device live, without a reload', async ({
    page,
    settingsPage,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await settingsPage.goto();
    await settingsPage.appearance('Dunkel').click();
    await settingsPage.appearance('System').click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);
    const body = page.locator('body');
    expect(await hasDarkBackground(body)).toBe(false);

    await page.emulateMedia({ colorScheme: 'dark' });
    await expect.poll(() => hasDarkBackground(body)).toBe(true);

    await page.emulateMedia({ colorScheme: 'light' });
    await expect.poll(() => hasDarkBackground(body)).toBe(false);
  });

  test('the scoreboard stays dark in every look', async ({
    page,
    settingsPage,
    startPage,
    teamPage,
  }) => {
    // the day after the Team's last Spiel: its result is on the scoreboard
    await page.clock.setFixedTime(new Date('2026-11-09T12:00:00+01:00'));
    await page.emulateMedia({ colorScheme: 'light' });
    await teamPage.goto(MTV_WASBUETTEL);
    await teamPage.follow.click();

    for (const name of ['System', 'Hell', 'Dunkel'] as const) {
      await settingsPage.goto();
      await settingsPage.appearance(name).click();
      await startPage.goto();
      const scoreboard = startPage
        .team('MTV Wasbüttel')
        .locator('.scoreboard')
        .first();
      await expect(scoreboard).toBeVisible();
      await expect(scoreboard).toHaveCSS('color-scheme', 'dark');
      expect(await hasDarkBackground(scoreboard)).toBe(true);
    }
  });
});
