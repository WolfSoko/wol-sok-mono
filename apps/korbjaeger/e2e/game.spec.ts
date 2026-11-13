import { expect, test } from './fixtures/pages.fixture';

/** In the fixtures, MTV Wasbüttel's Spiele; it beat MTV Gifhorn 78:47. */
const MTV_WASBUETTEL = 313036;
const HOME = 'MTV Wasbüttel -RST-';
const AWAY = 'MTV Gifhorn';

test.describe('Spiel page', () => {
  test.beforeEach(async ({ page }) => {
    // the day of the Team's last Spiel in the fixtures
    await page.clock.setFixedTime(new Date('2026-11-08T12:00:00+01:00'));
  });

  test('opens from the Team page with the result, the Halle and both Kader', async ({
    page,
    gamePage,
    teamPage,
  }) => {
    await teamPage.goto(MTV_WASBUETTEL);
    await teamPage.gameAgainst(AWAY).click();

    await expect(page).toHaveURL(/\/spiel\/2861436$/);
    await expect(gamePage.heading).toHaveText(`${HOME} – ${AWAY}`);
    await expect(gamePage.result).toHaveText('78:47');
    // Niedersachsen records no quarters, and the result is not confirmed yet
    await expect(gamePage.quarters).toHaveCount(0);
    await expect(gamePage.provisional).toHaveText('vorläufig');
    await expect(gamePage.status).toHaveText('Ergebnis noch nicht bestätigt');
    await expect(gamePage.venue.getByTestId('venue-name')).toHaveText(
      'Schulsporthalle'
    );
    await expect(gamePage.venue.getByTestId('venue-address')).toHaveText(
      'Schulstr. 12, 38553 Wasbüttel'
    );
    await expect(gamePage.navigation).toHaveAttribute('target', '_blank');
    await expect(gamePage.navigation).toHaveAttribute(
      'href',
      /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=Schulsporthalle/
    );

    await expect(gamePage.roster).toHaveCount(2);
    for (const team of [HOME, AWAY]) {
      const roster = gamePage.rosterOf(team);
      await expect(gamePage.player(roster)).toHaveCount(9);
      await expect(gamePage.withoutStats(roster)).toContainText(
        'keine Spielerwerte erfasst'
      );
    }
    const away = gamePage.rosterOf(AWAY);
    await expect(gamePage.player(away).first().getByRole('cell')).toHaveText([
      '7',
      'Orvin Nesselbach',
    ]);
    await expect(
      gamePage.player(away).filter({ hasText: 'Anonymer Spieler' })
    ).toHaveCount(3);

    await gamePage.heading.getByRole('link', { name: HOME }).click();
    await expect(teamPage.heading).toHaveText('MTV Wasbüttel');
  });

  test('shows the quarters and the Spielerwerte where the Verband records them', async ({
    gamePage,
  }) => {
    await gamePage.goto(2911141);

    await expect(gamePage.result).toHaveText('99:90');
    await expect(gamePage.quarters.first().getByRole('cell')).toHaveText([
      'Post SV Nürnberg',
      '26',
      '30',
      '29',
      '14',
      '99',
    ]);
    const away = gamePage.rosterOf('VR-Bank Würzburg Baskets Akademie');
    await expect(gamePage.withoutStats(away)).toHaveCount(0);
    await expect(gamePage.player(away).nth(1).getByRole('cell')).toHaveText([
      'Ilvio Mistelgrund',
      '29',
      '12',
      '3',
      '2/7',
      '3',
    ]);
  });

  test('shows every Spielerwert where the Verband records them all, readable on a phone', async ({
    page,
    gamePage,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await gamePage.goto(2861555);

    const home = gamePage.roster.first();
    await expect(home.getByRole('columnheader')).toHaveText([
      'Nr.',
      'Name',
      'Min.',
      'Pkt.',
      'FK',
      '3P',
      'FW',
      'Reb.',
      'Ass.',
      'BG',
      'BV',
      'Bl.',
      'F',
      'Eff.',
    ]);
    await expect(home.getByTestId('roster-starter')).toHaveCount(5);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);

    await home
      .locator('.table')
      .evaluate((standings) => (standings.scrollLeft = standings.scrollWidth));
    const name = await gamePage
      .player(home)
      .first()
      .locator('td.mat-column-name')
      .boundingBox();
    expect(name?.x).toBeGreaterThanOrEqual(0);
    expect((name?.x ?? 0) + (name?.width ?? 0)).toBeLessThanOrEqual(360);
  });

  test('says when there is no Spielbericht yet', async ({ gamePage }) => {
    await gamePage.goto(2843814);

    await expect(gamePage.status).toHaveText('Noch kein Ergebnis');
    await expect(gamePage.reportMissing).toContainText(
      'Noch kein Spielbericht'
    );
    await expect(gamePage.roster).toHaveCount(0);
  });
});
