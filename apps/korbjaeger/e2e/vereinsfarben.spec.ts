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
    const eigene = await teamPage.linienfarbe();

    await teamPage.vereinsfarbenWaehlen('Königsblau');
    await expect(teamPage.vereinsfarbenBlatt).toBeHidden();

    await expect.poll(() => teamPage.linienfarbe()).not.toBe(eigene);
    const blau = await teamPage.linienfarbe();
    await page.reload();
    await expect.poll(() => teamPage.linienfarbe()).toBe(blau);

    await teamPage.vereinsfarbenZuruecksetzen();
    await expect(teamPage.vereinsfarbenBlatt).toBeHidden();
    await expect.poll(() => teamPage.linienfarbe()).toBe(eigene);
  });
});
