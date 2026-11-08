import { expect, test } from './fixtures/team-page.fixture';

/** In the fixtures, MTV Wasbüttel plays a friendly Liga, then a Vorrunde. */
const TEAM_IN_ZWEI_LIGEN = 313036;
const TESTSPIELE = 'Testspiele Braunschweig u12';

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
