import { expect, test } from './fixtures/pages.fixture';

/** In the fixtures, MTV Wasbüttel's Team. */
const TEAM = 313036;

test.describe('Vereinsfarben', () => {
  test("puts a Verein's colours on its Team page, kept across a reload, and takes them back", async ({
    page,
    teamPage,
  }) => {
    await teamPage.goto(TEAM);
    await expect(teamPage.heading).toHaveText('MTV Wasbüttel');
    const own = await teamPage.lineColor();

    await teamPage.chooseClubColors('Königsblau');
    await expect(teamPage.clubColorsSheet).toBeHidden();

    await expect.poll(() => teamPage.lineColor()).not.toBe(own);
    const blue = await teamPage.lineColor();
    await page.reload();
    await expect.poll(() => teamPage.lineColor()).toBe(blue);

    await teamPage.resetClubColors();
    await expect(teamPage.clubColorsSheet).toBeHidden();
    await expect.poll(() => teamPage.lineColor()).toBe(own);
  });
});
