import { expect, test } from './fixtures/pages.fixture';

/** In the fixtures, MTV Wasbüttel's Spiele; it beat MTV Gifhorn 78:47. */
const MTV_WASBUETTEL = 313036;
const HEIM = 'MTV Wasbüttel -RST-';
const GAST = 'MTV Gifhorn';

test.describe('Spiel page', () => {
  test.beforeEach(async ({ page }) => {
    // the day of the Team's last Spiel in the fixtures
    await page.clock.setFixedTime(new Date('2026-11-08T12:00:00+01:00'));
  });

  test('opens from the Team page with the result, the Halle and both Kader', async ({
    page,
    spielPage,
    teamPage,
  }) => {
    await teamPage.goto(MTV_WASBUETTEL);
    await teamPage.spielGegen(GAST).click();

    await expect(page).toHaveURL(/\/spiel\/2861436$/);
    await expect(spielPage.heading).toHaveText(`${HEIM} – ${GAST}`);
    await expect(spielPage.ergebnis).toHaveText('78:47');
    // Niedersachsen records no quarters, and the result is not confirmed yet
    await expect(spielPage.viertel).toHaveCount(0);
    await expect(spielPage.vorlaeufig).toHaveText('vorläufig');
    await expect(spielPage.status).toHaveText('Ergebnis noch nicht bestätigt');
    await expect(spielPage.halle.getByTestId('venue-name')).toHaveText(
      'Schulsporthalle'
    );
    await expect(spielPage.halle.getByTestId('venue-address')).toHaveText(
      'Schulstr. 12, 38553 Wasbüttel'
    );
    await expect(spielPage.navigation).toHaveAttribute('target', '_blank');
    await expect(spielPage.navigation).toHaveAttribute(
      'href',
      /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=Schulsporthalle/
    );

    await expect(spielPage.kader).toHaveCount(2);
    for (const team of [HEIM, GAST]) {
      const kader = spielPage.kaderVon(team);
      await expect(spielPage.spieler(kader)).toHaveCount(9);
      await expect(spielPage.ohneWerte(kader)).toContainText(
        'keine Spielerwerte erfasst'
      );
    }
    const gast = spielPage.kaderVon(GAST);
    await expect(spielPage.spieler(gast).first().getByRole('cell')).toHaveText([
      '7',
      'Orvin Nesselbach',
    ]);
    await expect(
      spielPage.spieler(gast).filter({ hasText: 'Anonymer Spieler' })
    ).toHaveCount(3);

    await spielPage.heading.getByRole('link', { name: HEIM }).click();
    await expect(teamPage.heading).toHaveText('MTV Wasbüttel');
  });

  test('shows the quarters and the Spielerwerte where the Verband records them', async ({
    spielPage,
  }) => {
    await spielPage.goto(2911141);

    await expect(spielPage.ergebnis).toHaveText('99:90');
    await expect(spielPage.viertel.first().getByRole('cell')).toHaveText([
      'Post SV Nürnberg',
      '26',
      '30',
      '29',
      '14',
      '99',
    ]);
    const gast = spielPage.kaderVon('VR-Bank Würzburg Baskets Akademie');
    await expect(spielPage.ohneWerte(gast)).toHaveCount(0);
    await expect(spielPage.spieler(gast).nth(1).getByRole('cell')).toHaveText([
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
    spielPage,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await spielPage.goto(2861555);

    const heim = spielPage.kader.first();
    await expect(heim.getByRole('columnheader')).toHaveText([
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
    await expect(heim.getByTestId('roster-starter')).toHaveCount(5);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);

    await heim
      .locator('.table')
      .evaluate((tabelle) => (tabelle.scrollLeft = tabelle.scrollWidth));
    const name = await spielPage
      .spieler(heim)
      .first()
      .locator('td.mat-column-name')
      .boundingBox();
    expect(name?.x).toBeGreaterThanOrEqual(0);
    expect((name?.x ?? 0) + (name?.width ?? 0)).toBeLessThanOrEqual(360);
  });

  test('says when there is no Spielbericht yet', async ({ spielPage }) => {
    await spielPage.goto(2843814);

    await expect(spielPage.status).toHaveText('Noch kein Ergebnis');
    await expect(spielPage.berichtFehlt).toContainText(
      'Noch kein Spielbericht'
    );
    await expect(spielPage.kader).toHaveCount(0);
  });
});
