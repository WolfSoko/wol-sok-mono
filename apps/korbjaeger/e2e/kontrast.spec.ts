import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures/pages.fixture';
import { mitDarstellung } from './darstellung';

/** In the fixtures, MTV Wasbüttel's Spiele; it beat MTV Gifhorn 78:47. */
const MTV_WASBUETTEL = 313036;
const SPIEL_GEGEN_GIFHORN = 2861436;

test.describe('contrast', () => {
  test.beforeEach(async ({ page }) => {
    // the day after the Team's last Spiel: its result is on the scoreboard
    await page.clock.setFixedTime(new Date('2026-11-09T12:00:00+01:00'));
  });

  for (const wahl of ['light', 'dark'] as const) {
    test(`axe finds no contrast errors in the ${wahl} look`, async ({
      page,
      startPage,
      teamPage,
      spielPage,
    }) => {
      await mitDarstellung(page, wahl);
      const kontrast = async (): Promise<void> => {
        const { violations } = await new AxeBuilder({ page })
          .withRules(['color-contrast'])
          .analyze();
        expect(violations).toEqual([]);
      };

      await teamPage.goto(MTV_WASBUETTEL);
      await teamPage.folgen.click();
      await expect(teamPage.nichtMehrFolgen).toBeVisible();
      await kontrast();

      await startPage.goto();
      await expect(
        startPage.letztesErgebnis(startPage.team('MTV Wasbüttel'))
      ).toBeVisible();
      await kontrast();

      await page.goto(`/spiel/${SPIEL_GEGEN_GIFHORN}`);
      await expect(spielPage.kader).toHaveCount(2);
      await kontrast();
    });
  }
});
