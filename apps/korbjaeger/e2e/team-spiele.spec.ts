import { expect, test } from './fixtures/pages.fixture';

/** In the fixtures, MTV Wasbüttel plays a friendly Liga, then a Vorrunde. */
const TEAM_IN_ZWEI_LIGEN = 313036;
const TESTSPIELE = 'Testspiele Braunschweig u12';
const VORRUNDE = 'Regionsvorrunde Nord Braunschweig mu12';

test.describe('Team page', () => {
  test("lists the Spiele of both of the Team's Ligen by date", async ({
    teamPage,
  }) => {
    await teamPage.goto(TEAM_IN_ZWEI_LIGEN);

    await expect(teamPage.heading).toHaveText('MTV Wasbüttel');
    await expect(teamPage.spiele).toHaveCount(6);
    const spiele = await teamPage.eintraege();

    expect(spiele[0]).toEqual({
      datum: 'Sa., 29.08.2026',
      ort: 'Auswärts',
      gegner: 'SV Groß Schwülper',
      liga: TESTSPIELE,
      ergebnis: '24:129',
    });
    expect(spiele[2]).toMatchObject({
      datum: 'So., 20.09.2026',
      ort: 'Heim',
      gegner: 'MTV Gifhorn',
      ergebnis: '78:47',
    });
    const ligen = new Set(spiele.map(({ liga }) => liga));
    expect(ligen.size).toBe(2);
    const tage = spiele.map(({ datum }) => datum.slice(-10));
    expect(tage).toEqual(
      [...tage].sort((a, b) => isoDay(a).localeCompare(isoDay(b)))
    );
  });

  test("shows both Ligen's Tabellen, the current first, the Team highlighted", async ({
    page,
    teamPage,
  }) => {
    // the day of the Team's last Spiel in the fixtures: its Vorrunde's
    await page.clock.setFixedTime(new Date('2026-11-08T12:00:00+01:00'));
    await teamPage.goto(TEAM_IN_ZWEI_LIGEN);

    await expect(
      teamPage.tabellen.getByRole('heading', { level: 3 })
    ).toHaveText([VORRUNDE, TESTSPIELE]);
    const vorrunde = teamPage.tabelle(VORRUNDE);
    await expect(teamPage.zeilen(vorrunde)).toHaveCount(6);
    const eigene = teamPage.eigeneZeile(vorrunde);
    await expect(eigene).toHaveCount(1);
    await expect(eigene.getByRole('cell')).toHaveText([
      '2',
      'MTV Wasbüttel -RST- (dein Team)',
      '5',
      '4',
      '1',
      '470:204',
      '+266',
    ]);
    await expect(teamPage.tabelle(TESTSPIELE)).toContainText(
      'Für diese Liga führt der DBB keine Tabelle.'
    );
  });

  test('says when the DBB knows no such Team', async ({ page, teamPage }) => {
    await teamPage.goto(1);

    await expect(page.getByRole('alert')).toHaveText(
      'Dieses Team kennt der DBB nicht.'
    );
  });
});

/** `29.08.2026` as `2026-08-29`, so days sort by text. */
function isoDay(day: string): string {
  return day.split('.').reverse().join('-');
}
