import { expect, test } from './fixtures/pages.fixture';

/** In the fixtures, MTV Wasbüttel's last Spiel is on 8 November 2026. */
const MTV_WASBUETTEL = 313036;

test.describe('Meine Teams', () => {
  test.beforeEach(async ({ page }) => {
    // the day after the Team's last Spiel in the fixtures: all are played,
    // so the overview shows the last result only
    await page.clock.setFixedTime(new Date('2026-11-09T12:00:00+01:00'));
  });

  test('a Team followed on its page shows on the overview, after a reload too', async ({
    page,
    startPage,
    teamPage,
  }) => {
    await startPage.goto();
    await expect(startPage.empty).toBeVisible();

    await teamPage.goto(MTV_WASBUETTEL);
    await expect(teamPage.follow).toBeVisible();
    await teamPage.follow.click();
    await expect(teamPage.unfollow).toBeVisible();

    await page.getByRole('link', { name: 'Korbjäger' }).click();
    const team = startPage.team('MTV Wasbüttel');
    await expect(startPage.teams).toHaveCount(1);
    await expect(startPage.nextGame(team)).toHaveCount(0);
    await expect(startPage.lastResult(team)).toContainText(
      'So., 08.11.2026 · 09:00 Uhr'
    );
    await expect(startPage.lastResult(team)).toContainText(
      'Heim gegen TV Jahn Wolfsburg Honeybadgers -RST-'
    );
    await expect(startPage.lastResult(team)).toContainText('58:67');
    await expect(startPage.searchTeam).toHaveCount(0);
    await expect(startPage.searchFurtherTeam).toHaveAttribute(
      'href',
      '/suchen'
    );

    await page.reload();
    await expect(startPage.teams).toHaveCount(1);
    await expect(startPage.lastResult(team)).toContainText('58:67');

    await team.getByRole('link', { name: 'MTV Wasbüttel' }).click();
    await expect(teamPage.heading).toHaveText('MTV Wasbüttel');
    await teamPage.unfollow.click();
    await expect(teamPage.follow).toBeVisible();
    await page.reload();
    await expect(teamPage.follow).toBeVisible();
    await startPage.goto();
    await expect(startPage.empty).toBeVisible();
    await expect(startPage.searchFurtherTeam).toHaveCount(0);
  });

  test('a Team unfollowed from its card is gone, after a reload too, unless undone', async ({
    page,
    startPage,
    teamPage,
  }) => {
    await teamPage.goto(MTV_WASBUETTEL);
    await teamPage.follow.click();
    await startPage.goto();
    const team = startPage.team('MTV Wasbüttel');
    await expect(startPage.lastResult(team)).toContainText('58:67');

    await startPage.unfollow('MTV Wasbüttel').click();
    await expect(startPage.empty).toBeVisible();
    await startPage.undo.click();
    await expect(startPage.teams).toHaveCount(1);

    await startPage.unfollow('MTV Wasbüttel').click();
    await expect(startPage.empty).toBeVisible();
    await page.reload();
    await expect(startPage.empty).toBeVisible();
  });
});
