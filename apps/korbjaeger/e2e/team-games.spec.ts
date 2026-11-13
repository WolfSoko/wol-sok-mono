import { expect, test } from './fixtures/pages.fixture';
import { followButton } from './pos/follow';

/** In the fixtures, MTV Wasbüttel plays a friendly Liga, then a Vorrunde. */
const TEAM_IN_TWO_LEAGUES = 313036;
const FRIENDLIES = 'Testspiele Braunschweig u12';
const FIRST_ROUND = 'Regionsvorrunde Nord Braunschweig mu12';

test.describe('Team page', () => {
  test("lists the Spiele of both of the Team's Ligen by date", async ({
    teamPage,
  }) => {
    await teamPage.goto(TEAM_IN_TWO_LEAGUES);

    await expect(teamPage.heading).toHaveText('MTV Wasbüttel');
    await expect(teamPage.games).toHaveCount(6);
    const games = await teamPage.entries();

    expect(games[0]).toEqual({
      date: 'Sa., 29.08.2026',
      venue: 'Auswärts',
      opponent: 'SV Groß Schwülper',
      league: FRIENDLIES,
      result: '24:129',
    });
    expect(games[2]).toMatchObject({
      date: 'So., 20.09.2026',
      venue: 'Heim',
      opponent: 'MTV Gifhorn',
      result: '78:47',
    });
    const leagues = new Set(games.map(({ league }) => league));
    expect(leagues.size).toBe(2);
    const days = games.map(({ date }) => date.slice(-10));
    expect(days).toEqual(
      [...days].sort((a, b) => isoDay(a).localeCompare(isoDay(b)))
    );
  });

  test('keeps each Spiel inside its row on a phone, its text wrapped', async ({
    page,
    teamPage,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await teamPage.goto(TEAM_IN_TWO_LEAGUES);
    await expect(teamPage.games).toHaveCount(6);

    // each row's own box, its content's and its texts', all at once
    const boxes = await teamPage.games.evaluateAll((rows) =>
      rows.map((row) => {
        const line = row.getBoundingClientRect();
        const content = row.querySelector('korb-game-row');
        const texts = [
          ...(content?.querySelectorAll<HTMLElement>('[data-qa^="game-"]') ??
            []),
        ];
        return {
          line: { top: line.top, bottom: line.bottom },
          content: content && {
            top: content.getBoundingClientRect().top,
            bottom: content.getBoundingClientRect().bottom,
          },
          texts: texts.map((text) => {
            const box = text.getBoundingClientRect();
            return {
              top: box.top,
              bottom: box.bottom,
              // cut off sideways where it holds more than it shows
              clipped: text.scrollWidth > text.clientWidth + 1,
            };
          }),
        };
      })
    );
    expect(boxes).toHaveLength(6);
    for (const { line, content, texts } of boxes) {
      expect(content).toBeDefined();
      expect(content?.top).toBeGreaterThanOrEqual(line.top);
      expect(content?.bottom).toBeLessThanOrEqual(line.bottom);
      expect(texts.length).toBeGreaterThan(0);
      for (const text of texts) {
        expect(text.top).toBeGreaterThanOrEqual(line.top);
        expect(text.bottom).toBeLessThanOrEqual(line.bottom);
        expect(text.clipped).toBe(false);
      }
    }
  });

  test("shows both Ligen's Tabellen, the current first, the Team highlighted", async ({
    page,
    teamPage,
  }) => {
    // the day of the Team's last Spiel in the fixtures: its Vorrunde's
    await page.clock.setFixedTime(new Date('2026-11-08T12:00:00+01:00'));
    await teamPage.goto(TEAM_IN_TWO_LEAGUES);

    await expect(
      teamPage.standingsTables.getByRole('heading', { level: 3 })
    ).toHaveText([FIRST_ROUND, FRIENDLIES]);
    const firstRound = teamPage.standings(FIRST_ROUND);
    await expect(teamPage.rows(firstRound)).toHaveCount(6);
    const own = teamPage.ownRow(firstRound);
    await expect(own).toHaveCount(1);
    await expect(own.getByRole('cell')).toHaveText([
      '2',
      'MTV Wasbüttel -RST- (dein Team)',
      '5',
      '4',
      '1',
      '470:204',
      '+266',
    ]);
    await expect(teamPage.standings(FRIENDLIES)).toContainText(
      'Für diese Liga führt der DBB keine Tabelle.'
    );
  });

  test('offers another Team of its Verein and follows it', async ({
    page,
    teamPage,
  }) => {
    await page.clock.setFixedTime(new Date('2026-11-08T12:00:00+01:00'));
    await teamPage.goto(TEAM_IN_TWO_LEAGUES);

    const siblings = teamPage.clubTeam('Regionsliga Braunschweig mu10');
    await expect(siblings.getByRole('link')).toHaveText('MTV Wasbüttel -RST-');
    const follow = followButton(siblings, 'MTV Wasbüttel -RST-', {
      followed: false,
    });
    await expect(follow).toBeVisible();
    await follow.click();

    await expect(
      followButton(siblings, 'MTV Wasbüttel -RST-', { followed: true })
    ).toBeVisible();
    await expect(teamPage.follow).toBeVisible();
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
