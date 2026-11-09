import { expect, test } from './fixtures/pages.fixture';

/** In the fixtures, MTV Wasbüttel's Spiele; it beat MTV Gifhorn 78:47. */
const MTV_WASBUETTEL = 313036;
const TEAM = 'MTV Wasbüttel';
/** How the Spiel names the Team, which the Spiel page's breadcrumb shows. */
const TEAM_AS_SPIEL_NAMES_IT = 'MTV Wasbüttel -RST-';
const GAST = 'MTV Gifhorn';

test.describe('Title bar', () => {
  test.beforeEach(async ({ page }) => {
    // the day of the Team's last Spiel in the fixtures
    await page.clock.setFixedTime(new Date('2026-11-08T12:00:00+01:00'));
  });

  test("leads from the overview to a followed Team's Spiel and back up the breadcrumb", async ({
    page,
    startPage,
    teamPage,
    titleBar,
  }) => {
    await teamPage.goto(MTV_WASBUETTEL);
    await teamPage.folgen.click();
    await startPage.goto();
    await expect(titleBar.levels).toHaveText(['Korbjäger']);
    await expect(titleBar.current).toHaveText('Korbjäger');

    await startPage.team(TEAM).getByTestId('ueberblick-name').click();
    await expect(titleBar.levels).toHaveText(['Korbjäger', TEAM]);
    await teamPage.spielGegen(GAST).click();
    await expect(page).toHaveURL(/\/spiel\/2861436$/);
    await expect(titleBar.levels).toHaveText([
      'Korbjäger',
      TEAM_AS_SPIEL_NAMES_IT,
      'Spiel',
    ]);
    await expect(titleBar.current).toHaveText('Spiel');

    await titleBar.level(TEAM_AS_SPIEL_NAMES_IT).click();
    await expect(page).toHaveURL(new RegExp(`/team/${MTV_WASBUETTEL}$`));
    await titleBar.level('Korbjäger').click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('goes back and forward through the pages opened', async ({
    page,
    teamPage,
    titleBar,
  }) => {
    await teamPage.goto(MTV_WASBUETTEL);
    await teamPage.spielGegen(GAST).click();
    await expect(page).toHaveURL(/\/spiel\/2861436$/);
    await expect(titleBar.forward).toBeDisabled();

    await titleBar.back.click();
    await expect(page).toHaveURL(new RegExp(`/team/${MTV_WASBUETTEL}$`));
    await expect(titleBar.forward).toBeEnabled();

    await titleBar.forward.click();
    await expect(page).toHaveURL(/\/spiel\/2861436$/);
    await expect(titleBar.forward).toBeDisabled();
  });

  test('goes up to the overview from a Team page opened directly', async ({
    page,
    teamPage,
    titleBar,
  }) => {
    await teamPage.goto(MTV_WASBUETTEL);
    await expect(teamPage.heading).toHaveText(TEAM);

    await titleBar.back.click();

    await expect(page).toHaveURL(/\/$/);
    // up is a new entry, so back returns to the Team
    await titleBar.back.click();
    await expect(teamPage.heading).toHaveText(TEAM);
  });

  test('has neither back nor forward on the overview opened directly', async ({
    startPage,
    titleBar,
  }) => {
    await startPage.goto();

    await expect(titleBar.back).toBeDisabled();
    await expect(titleBar.forward).toBeDisabled();
  });

  test('fits a phone with a long Team name', async ({
    page,
    teamPage,
    titleBar,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await teamPage.goto(MTV_WASBUETTEL);
    await teamPage.spielGegen(GAST).click();
    await expect(titleBar.current).toHaveText('Spiel');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(titleBar.back).toBeInViewport();
    await expect(
      page.getByRole('link', { name: 'Einstellungen' })
    ).toBeInViewport();
  });
});
