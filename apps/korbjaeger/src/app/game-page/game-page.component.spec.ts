import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { provideRouter } from '@angular/router';
import {
  BasketballDataError,
  type Venue,
  type Roster,
  type GameDetails,
  type GameReport,
  type PlayerStats,
} from '@wolsok/feat-shared-basketball-data';
import { playerStatsOf } from '@wolsok/feat-shared-basketball-data/testing';
import { SELECTION } from '../selection/selection';
import {
  type Selection,
  SelectionTooNewError,
  type Child,
  LocalSelection,
} from '@wolsok/feat-korbjaeger-selection';
import { fakeSelection } from '@wolsok/feat-korbjaeger-selection/testing';
import {
  BASKETBALL_DATA,
  type KorbjaegerData,
} from '../basketball-data/basketball-data.provider';
import type { KorbReadOptions } from '../basketball-data/reading';
import type { AsOf } from '../basketball-data/as-of';
import { NOW } from '../now';
import { GamePageComponent } from './game-page.component';
import { Breadcrumb } from '../navigation/breadcrumb';

/** Noon on the day of the Spiel, in Germany. */
const NOW_IN_SPEC = Date.parse('2026-11-08T12:00:00+01:00');

const VENUE: Venue = {
  name: 'Schulsporthalle',
  street: 'Schulstr. 12',
  postcode: '38553',
  town: 'Wasbüttel',
};

const PLAYED_GAME: GameDetails = {
  game: {
    id: 2861436,
    leagueId: 54862,
    matchday: 3,
    date: '2026-09-20',
    time: '09:00',
    home: {
      kind: 'team',
      team: { id: 313036, name: 'MTV Wasbüttel', clubId: 1837 },
    },
    away: {
      kind: 'team',
      team: { id: 201500, name: 'MTV Gifhorn', clubId: 201500 },
    },
    status: {
      kind: 'played',
      result: { home: 78, away: 47 },
      confirmed: true,
    },
  },
  league: {
    id: 54862,
    name: 'Regionsvorrunde Nord Braunschweig mu12',
    association: { id: 7, name: 'Niedersachsen' },
    ageGroup: 'U12',
    gender: 'mixed',
    division: 'Regionsliga',
  },
  venue: VENUE,
  quarters: [
    { home: 20, away: 10 },
    { home: 18, away: 12 },
    { home: 22, away: 9 },
    { home: 18, away: 16 },
  ],
  overtimes: [],
};

function stats(points: number, fouls = 2): PlayerStats {
  return playerStatsOf({
    points,
    twoPointers: { made: 4, attempted: 0 },
    threePointers: { made: 1, attempted: 0 },
    freeThrows: { made: 3, attempted: 5 },
    fouls,
  });
}

/** A starter of the 1. Regionalliga, every value recorded. */
const ALL_STATS = playerStatsOf({
  playingTimeSeconds: 1724,
  points: 16,
  twoPointers: { made: 8, attempted: 12 },
  threePointers: { made: 0, attempted: 2 },
  freeThrows: { made: 0, attempted: 2 },
  rebounds: 7,
  assists: 1,
  steals: 2,
  turnovers: 1,
  blocks: 1,
  fouls: 2,
  efficiency: 18,
  startingFive: true,
});

const WITH_STATS: Roster = {
  playerStatsRecorded: true,
  entries: [
    {
      kind: 'named',
      personId: 91692638,
      firstName: 'Ilvio',
      lastName: 'Mistelgrund',
      shirtNumber: '7',
      playerStats: stats(14),
    },
    { kind: 'anonymous', playerStats: stats(10, 4) },
  ],
};

const WITHOUT_STATS: Roster = {
  playerStatsRecorded: false,
  entries: [
    {
      kind: 'named',
      personId: 92256481,
      firstName: 'Delon',
      lastName: 'Nesselbach',
      shirtNumber: '30',
    },
    { kind: 'anonymous' },
  ],
};

function report(home: Roster, away: Roster): GameReport {
  return { gameId: 2861436, home, away };
}

type GameRead = KorbjaegerData['game'];
type ReportRead = KorbjaegerData['gameReport'];

function fakeData(
  game: GameRead,
  gameReport: ReportRead
): {
  readonly game: ReturnType<typeof vi.fn<GameRead>>;
  readonly gameReport: ReturnType<typeof vi.fn<ReportRead>>;
} {
  return {
    game: vi.fn<GameRead>(game),
    gameReport: vi.fn<ReportRead>(gameReport),
  };
}

const NEVER = new Promise<never>(() => undefined);

async function render(
  data: ReturnType<typeof fakeData>,
  gameId = '2861436'
): Promise<HTMLElement> {
  return (await renderWith(data, new LocalSelection(undefined), gameId)).page;
}

/** Renders the page of `gameId` on `data` with `selection`. */
async function renderWith(
  data: ReturnType<typeof fakeData>,
  selection: Selection,
  gameId = '2861436'
): Promise<{
  readonly page: HTMLElement;
  /** Waits for the reads that settle, the dialogs and the page. */
  readonly settled: () => Promise<void>;
}> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: BASKETBALL_DATA, useValue: data },
      { provide: NOW, useValue: signal(NOW_IN_SPEC) },
      { provide: SELECTION, useValue: selection },
      // the dialogs close at once, without waiting for an animation
      { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
    ],
  });
  const fixture = TestBed.createComponent(GamePageComponent);
  fixture.componentRef.setInput('gameId', gameId);
  // not whenStable: it waits for every read, and some never settle here
  const settled = async (): Promise<void> => {
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  };
  await settled();
  return { page: fixture.nativeElement as HTMLElement, settled };
}

function text(element: Element | null | undefined): string | undefined {
  return element?.textContent?.replace(/\s+/g, ' ').trim();
}

function part(page: ParentNode, name: string): HTMLElement | null {
  return page.querySelector<HTMLElement>(`[data-qa="${name}"]`);
}

function all(page: ParentNode, name: string): HTMLElement[] {
  return [...page.querySelectorAll<HTMLElement>(`[data-qa="${name}"]`)];
}

/** The cells of each line of a table, as text. */
function cells(standings: HTMLElement | null, row: string): string[][] {
  return all(standings ?? document, row).map((tr) =>
    [...tr.querySelectorAll('td')].map((td) => text(td) ?? '')
  );
}

function headerCells(standings: HTMLElement | null): string[] {
  return [...(standings?.querySelectorAll('th') ?? [])].map(
    (th) => th.getAttribute('aria-label') ?? text(th) ?? ''
  );
}

describe('GamePageComponent', () => {
  describe('the last good data', () => {
    const AN_HOUR_AGO: AsOf = {
      storedAt: NOW_IN_SPEC - 60 * 60_000,
      reason: 'unavailable',
    };

    it('labels the Spiel with the age of its last good data', async () => {
      const page = await render(
        fakeData(
          async (_game, options?: KorbReadOptions) => {
            options?.reading?.replaced(AN_HOUR_AGO);
            return PLAYED_GAME;
          },
          async () => report(WITH_STATS, WITHOUT_STATS)
        )
      );

      expect(text(part(page, 'game-as-of'))).toContain(
        'DBB nicht erreichbar · Stand: vor 1 Std.'
      );
      // a Spielbericht names children: it is never kept, so never stale
      expect(part(page, 'spielbericht-stand')).toBeNull();
    });

    it('labels neither while both were just read', async () => {
      const page = await render(
        fakeData(
          async () => PLAYED_GAME,
          async () => report(WITH_STATS, WITHOUT_STATS)
        )
      );

      expect(page.querySelector('[data-qa="as-of"]')).toBeNull();
    });
  });

  describe('the breadcrumb', () => {
    async function levelsWith(teams: readonly number[]) {
      const selection = new LocalSelection(undefined);
      for (const team of teams) {
        await selection.follow(team);
      }
      await renderWith(
        fakeData(
          async () => PLAYED_GAME,
          async () => undefined
        ),
        selection
      );
      return TestBed.inject(Breadcrumb).levels().slice(1);
    }

    it("leads up to the followed side's Team", async () => {
      expect(await levelsWith([201500])).toEqual([
        { title: 'MTV Gifhorn', link: ['/team', '201500'] },
        { title: 'Spiel' },
      ]);
    });

    it('takes the home side where both are followed', async () => {
      expect((await levelsWith([201500, 313036]))[0]?.title).toBe(
        'MTV Wasbüttel'
      );
    });

    it('names the Spiel right below the overview where no side is followed', async () => {
      expect(await levelsWith([])).toEqual([{ title: 'Spiel' }]);
    });
  });

  it("reads the Spiel and its Spielbericht of the page's id", async () => {
    const data = fakeData(
      async () => PLAYED_GAME,
      async () => undefined
    );

    await render(data);

    expect(data.game).toHaveBeenCalledWith(
      2861436,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(data.gameReport).toHaveBeenCalledWith(
      2861436,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('reads the new Spiel when the id changes, dropping the last one', async () => {
    const data = fakeData(
      (gameId) => (gameId === 2861436 ? Promise.resolve(PLAYED_GAME) : NEVER),
      (gameId) =>
        gameId === 2861436
          ? Promise.resolve(report(WITH_STATS, WITHOUT_STATS))
          : NEVER
    );
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: BASKETBALL_DATA, useValue: data },
      ],
    });
    const fixture = TestBed.createComponent(GamePageComponent);
    const settled = async (): Promise<void> => {
      fixture.detectChanges();
      await new Promise((resolve) => setTimeout(resolve));
      fixture.detectChanges();
    };
    fixture.componentRef.setInput('gameId', '2861436');
    await settled();
    const page = fixture.nativeElement as HTMLElement;
    expect(text(part(page, 'game-result'))).toBe('78:47');
    expect(all(page, 'roster')).toHaveLength(2);

    fixture.componentRef.setInput('gameId', '2911141');
    await settled();

    expect(data.game).toHaveBeenLastCalledWith(
      2911141,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(data.gameReport).toHaveBeenLastCalledWith(
      2911141,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(part(page, 'game-result')).toBeNull();
    expect(part(page, 'venue')).toBeNull();
    expect(all(page, 'roster')).toEqual([]);
    expect(text(page.querySelector('h1'))).toBe('Spiel');
  });

  describe('the Spiel', () => {
    it('shows the final score, day, time and Liga', async () => {
      const page = await render(
        fakeData(
          async () => PLAYED_GAME,
          async () => undefined
        )
      );

      expect(text(part(page, 'game-result'))).toBe('78:47');
      expect(text(part(page, 'game-when'))).toBe('So., 20.09.2026 · 09:00 Uhr');
      expect(text(part(page, 'game-league'))).toBe(
        'Regionsvorrunde Nord Braunschweig mu12'
      );
    });

    it('links both Teams to their Team pages', async () => {
      const page = await render(
        fakeData(
          async () => PLAYED_GAME,
          async () => undefined
        )
      );

      const heading = page.querySelector('h1');
      expect(text(heading)).toBe('MTV Wasbüttel – MTV Gifhorn');
      expect(
        [...(heading?.querySelectorAll('a') ?? [])].map((a) =>
          a.getAttribute('href')
        )
      ).toEqual(['/team/313036', '/team/201500']);
    });

    it('names a side the Liga has yet to settle without a link', async () => {
      const page = await render(
        fakeData(
          async () => ({
            ...PLAYED_GAME,
            game: {
              ...PLAYED_GAME.game,
              away: { kind: 'open', label: 'Nord 1. Platz' },
              status: { kind: 'scheduled' },
            },
          }),
          async () => undefined
        )
      );

      const heading = page.querySelector('h1');
      expect(text(heading)).toBe('MTV Wasbüttel – Nord 1. Platz');
      expect(heading?.querySelectorAll('a')).toHaveLength(1);
    });

    it('shows the quarter scores with the final score', async () => {
      const page = await render(
        fakeData(
          async () => PLAYED_GAME,
          async () => undefined
        )
      );

      const quarters = part(page, 'quarters');
      expect(headerCells(quarters)).toEqual([
        'Team',
        '1. Viertel',
        '2. Viertel',
        '3. Viertel',
        '4. Viertel',
        'Endstand',
      ]);
      expect(cells(quarters, 'quarters-row')).toEqual([
        ['MTV Wasbüttel', '20', '18', '22', '18', '78'],
        ['MTV Gifhorn', '10', '12', '9', '16', '47'],
      ]);
    });

    it.each<[string, GameDetails['game']['status']]>([
      ['planned', { kind: 'scheduled' }],
      ['cancelled', { kind: 'cancelled' }],
      ['forfeited without a result', { kind: 'forfeited', forfeitedBy: [] }],
    ])(
      'shows no final score for quarters of a Spiel %s',
      async (_case, status) => {
        const page = await render(
          fakeData(
            async () => ({
              ...PLAYED_GAME,
              game: { ...PLAYED_GAME.game, status },
            }),
            async () => undefined
          )
        );

        const quarters = part(page, 'quarters');
        expect(headerCells(quarters)).toEqual([
          'Team',
          '1. Viertel',
          '2. Viertel',
          '3. Viertel',
          '4. Viertel',
          'Endstand',
        ]);
        expect(cells(quarters, 'quarters-row')).toEqual([
          ['MTV Wasbüttel', '20', '18', '22', '18', '–'],
          ['MTV Gifhorn', '10', '12', '9', '16', '–'],
        ]);
        // the quarters' sums, 78 and 47, are no final score
        expect(text(quarters)).not.toMatch(/\b(78|47)\b/);
      }
    );

    it('adds each overtime after the quarters', async () => {
      const page = await render(
        fakeData(
          async () => ({
            ...PLAYED_GAME,
            overtimes: [{ home: 6, away: 4 }],
          }),
          async () => undefined
        )
      );

      const quarters = part(page, 'quarters');
      expect(headerCells(quarters)).toContain('1. Verlängerung');
      expect(
        [...(quarters?.querySelectorAll('th') ?? [])].map((th) => text(th))
      ).toEqual(['Team', '1.', '2.', '3.', '4.', 'V1', 'Endstand']);
      expect(cells(quarters, 'quarters-row')[0]).toEqual([
        'MTV Wasbüttel',
        '20',
        '18',
        '22',
        '18',
        '6',
        '78',
      ]);
    });

    it('shows no quarters where the Verband records none', async () => {
      const page = await render(
        fakeData(
          async () => ({ ...PLAYED_GAME, quarters: [] }),
          async () => undefined
        )
      );

      expect(part(page, 'quarters')).toBeNull();
      expect(text(part(page, 'game-result'))).toBe('78:47');
    });

    it.each([
      [
        'a Spiel without a result yet, planned or not entered',
        { kind: 'scheduled' },
        'Noch kein Ergebnis',
      ],
      ['a cancelled Spiel', { kind: 'cancelled' }, 'abgesagt'],
      [
        'a forfeited Spiel, with who gave up',
        { kind: 'forfeited', forfeitedBy: ['away'] },
        'kampflos · MTV Gifhorn hat verzichtet',
      ],
      [
        'a result not confirmed yet',
        {
          kind: 'played',
          result: { home: 78, away: 47 },
          confirmed: false,
        },
        'Ergebnis noch nicht bestätigt',
      ],
    ] as const)('shows %s', async (_case, status, display) => {
      const page = await render(
        fakeData(
          async () => ({
            ...PLAYED_GAME,
            game: { ...PLAYED_GAME.game, status },
            quarters: [],
          }),
          async () => undefined
        )
      );

      expect(text(part(page, 'game-status'))).toBe(display);
    });

    it('shows no status line and no vorläufig for a confirmed result', async () => {
      const page = await render(
        fakeData(
          async () => PLAYED_GAME,
          async () => undefined
        )
      );

      expect(part(page, 'game-status')).toBeNull();
      expect(part(page, 'game-provisional')).toBeNull();
    });

    it('marks a result not confirmed yet as vorläufig beside the score', async () => {
      const page = await render(
        fakeData(
          async () => ({
            ...PLAYED_GAME,
            game: {
              ...PLAYED_GAME.game,
              status: {
                kind: 'played',
                result: { home: 78, away: 47 },
                confirmed: false,
              },
            },
          }),
          async () => undefined
        )
      );

      expect(text(part(page, 'game-result'))).toBe('78:47');
      expect(text(part(page, 'game-provisional'))).toBe('vorläufig');
      expect(
        page.querySelector('.result')?.textContent?.replace(/\s+/g, ' ').trim()
      ).toBe('78:47 vorläufig');
      expect(text(part(page, 'game-status'))).toBe(
        'Ergebnis noch nicht bestätigt'
      );
    });

    it('shows a result the DBB never confirms (BBL, ProA, ProB) as final', async () => {
      const page = await render(
        fakeData(
          async () => ({
            ...PLAYED_GAME,
            game: {
              ...PLAYED_GAME.game,
              status: {
                kind: 'played',
                result: { home: 78, away: 47 },
                confirmed: false,
              },
            },
            league: {
              ...PLAYED_GAME.league,
              name: '1. Bundesliga (easyCredit BBL)',
              association: { id: 100, name: 'Bundesligen' },
              withoutGameReports: true,
              resultsNeverConfirmed: true,
            },
          }),
          async () => undefined
        )
      );

      expect(text(part(page, 'game-result'))).toBe('78:47');
      expect(part(page, 'game-provisional')).toBeNull();
      expect(part(page, 'game-status')).toBeNull();
    });

    it.each([
      ['a planned Spiel', { kind: 'scheduled' }],
      [
        'a forfeit',
        {
          kind: 'forfeited',
          forfeitedBy: ['away'],
          result: { home: 20, away: 0 },
        },
      ],
    ] as const)('does not mark %s as vorläufig', async (_case, status) => {
      const page = await render(
        fakeData(
          async () => ({
            ...PLAYED_GAME,
            game: { ...PLAYED_GAME.game, status },
          }),
          async () => undefined
        )
      );

      expect(part(page, 'game-provisional')).toBeNull();
    });
  });

  describe('the Halle', () => {
    it('shows its name and address with a link that opens navigation', async () => {
      const page = await render(
        fakeData(
          async () => PLAYED_GAME,
          async () => undefined
        )
      );

      const venue = part(page, 'venue');
      expect(text(part(venue ?? page, 'venue-name'))).toBe('Schulsporthalle');
      expect(text(part(venue ?? page, 'venue-address'))).toBe(
        'Schulstr. 12, 38553 Wasbüttel'
      );
      const link = venue?.querySelector('a');
      expect(link?.getAttribute('href')).toBe(
        'https://www.google.com/maps/search/?api=1&query=Schulsporthalle%2C%20Schulstr.%2012%2C%2038553%20Wasb%C3%BCttel'
      );
      expect(link?.getAttribute('target')).toBe('_blank');
      expect(link?.getAttribute('rel')).toBe('noopener');
    });

    it('says so where the DBB names no Halle yet', async () => {
      const { venue: _none, ...withoutVenue } = PLAYED_GAME;
      const page = await render(
        fakeData(
          async () => withoutVenue,
          async () => undefined
        )
      );

      expect(text(part(page, 'venue'))).toBe(
        'Die Halle steht noch nicht fest.'
      );
      expect(part(page, 'venue')?.querySelector('a')).toBeNull();
    });
  });

  describe('the Kader', () => {
    function roster(page: HTMLElement): HTMLElement[] {
      return all(page, 'roster');
    }

    it('lists both Kader under their Teams', async () => {
      const page = await render(
        fakeData(
          async () => PLAYED_GAME,
          async () => report(WITH_STATS, WITHOUT_STATS)
        )
      );

      expect(roster(page).map((k) => text(k.querySelector('h3')))).toEqual([
        'MTV Wasbüttel',
        'MTV Gifhorn',
      ]);
    });

    it('shows the Spielerwerte of a Kader the Verband records them for', async () => {
      const page = await render(
        fakeData(
          async () => PLAYED_GAME,
          async () => report(WITH_STATS, WITH_STATS)
        )
      );

      const [home] = roster(page);
      expect(headerCells(home)).toEqual([
        'Trikotnummer',
        'Name',
        'Punkte',
        'Feldkörbe',
        'Dreier',
        'Freiwürfe getroffen von versucht',
        'Fouls',
      ]);
      expect(cells(home, 'roster-row')).toEqual([
        ['7', 'Ilvio Mistelgrund', '14', '5', '1', '3/5', '2'],
        ['', 'Anonymer Spieler', '10', '5', '1', '3/5', '4'],
      ]);
      expect(part(home, 'roster-without-stats')).toBeNull();
      expect(part(home, 'roster-starter')).toBeNull();
    });

    it('shows every Spielerwert the Verband records, and the starting five', async () => {
      const allStats: Roster = {
        playerStatsRecorded: true,
        entries: [
          {
            kind: 'named',
            personId: 96606327,
            firstName: 'Rilla',
            lastName: 'Schlehenau',
            shirtNumber: '1',
            playerStats: ALL_STATS,
          },
          {
            kind: 'anonymous',
            playerStats: { ...ALL_STATS, startingFive: false },
          },
        ],
      };
      const page = await render(
        fakeData(
          async () => PLAYED_GAME,
          async () => report(allStats, WITHOUT_STATS)
        )
      );

      const [home] = roster(page);
      expect(headerCells(home)).toEqual([
        'Trikotnummer',
        'Name',
        'Spielzeit in Minuten',
        'Punkte',
        'Feldkörbe getroffen von versucht',
        'Dreier getroffen von versucht',
        'Freiwürfe getroffen von versucht',
        'Rebounds',
        'Assists',
        'Ballgewinne',
        'Ballverluste',
        'Blocks',
        'Fouls',
        'Effizienz',
      ]);
      const [starter, anonymous] = cells(home, 'roster-row');
      expect(starter.slice(2)).toEqual([
        '28:44',
        '16',
        '8/14',
        '0/2',
        '0/2',
        '7',
        '1',
        '2',
        '1',
        '1',
        '2',
        '18',
      ]);
      expect(all(home, 'roster-starter')).toHaveLength(1);
      expect(text(part(home, 'roster-starter'))).toContain('In der Startfünf');
      expect(anonymous[1]).toBe('Anonymer Spieler');
    });

    it('says "keine Spielerwerte erfasst" for a Kader without, never zeros', async () => {
      const page = await render(
        fakeData(
          async () => PLAYED_GAME,
          async () => report(WITH_STATS, WITHOUT_STATS)
        )
      );

      const [home, away] = roster(page);
      expect(text(part(away, 'roster-without-stats'))).toContain(
        'keine Spielerwerte erfasst'
      );
      expect(headerCells(away)).toEqual(['Trikotnummer', 'Name']);
      expect(cells(away, 'roster-row')).toEqual([
        ['30', 'Delon Nesselbach'],
        ['', 'Anonymer Spieler'],
      ]);
      expect(part(home, 'roster-without-stats')).toBeNull();
    });

    it('leaves out the shirt numbers where the Kader lists none', async () => {
      const withoutNumbers: Roster = {
        playerStatsRecorded: true,
        entries: [{ kind: 'anonymous', playerStats: stats(10) }],
      };
      const page = await render(
        fakeData(
          async () => PLAYED_GAME,
          async () => report(withoutNumbers, WITHOUT_STATS)
        )
      );

      const [home, away] = roster(page);
      expect(headerCells(home)[0]).toBe('Name');
      expect(cells(home, 'roster-row')).toEqual([
        ['Anonymer Spieler', '10', '5', '1', '3/5', '2'],
      ]);
      expect(headerCells(away)[0]).toBe('Trikotnummer');
    });

    it('says "noch kein Spielbericht" while there is none', async () => {
      const page = await render(
        fakeData(
          async () => PLAYED_GAME,
          async () => undefined
        )
      );

      expect(roster(page)).toEqual([]);
      expect(text(part(page, 'game-report-missing'))).toBe(
        'Noch kein Spielbericht. Schau später noch einmal vorbei.'
      );
    });

    it('says a cancelled Spiel has no Spielbericht to wait for', async () => {
      const page = await render(
        fakeData(
          async () => ({
            ...PLAYED_GAME,
            game: { ...PLAYED_GAME.game, status: { kind: 'cancelled' } },
          }),
          async () => undefined
        )
      );

      expect(text(part(page, 'game-report-missing'))).toBe(
        'Das Spiel fällt aus, einen Spielbericht gibt es nicht.'
      );
    });

    describe('in a Liga the DBB keeps no Spielberichte for', () => {
      const WITHOUT_REPORTS: GameDetails = {
        ...PLAYED_GAME,
        league: { ...PLAYED_GAME.league, withoutGameReports: true },
      };

      it('says so instead of asking to come back later', async () => {
        const page = await render(
          fakeData(
            async () => WITHOUT_REPORTS,
            async () => undefined
          )
        );

        expect(text(part(page, 'game-report-missing'))).toBe(
          'Für diese Liga führt der DBB keine Spielberichte, Kader und Viertel gibt es hier nicht.'
        );
      });

      it('still says a cancelled Spiel has no Spielbericht', async () => {
        const page = await render(
          fakeData(
            async () => ({
              ...WITHOUT_REPORTS,
              game: { ...WITHOUT_REPORTS.game, status: { kind: 'cancelled' } },
            }),
            async () => undefined
          )
        );

        expect(text(part(page, 'game-report-missing'))).toBe(
          'Das Spiel fällt aus, einen Spielbericht gibt es nicht.'
        );
      });

      it('shows a Spielbericht that comes all the same', async () => {
        const page = await render(
          fakeData(
            async () => WITHOUT_REPORTS,
            async () => report(WITH_STATS, WITHOUT_STATS)
          )
        );

        expect(roster(page)).toHaveLength(2);
        expect(part(page, 'game-report-missing')).toBeNull();
      });
    });

    it('shows an Anonymer Spieler as anonymous: no link, no number, no id', async () => {
      const page = await render(
        fakeData(
          async () => PLAYED_GAME,
          async () => report(WITHOUT_STATS, WITHOUT_STATS)
        )
      );

      const [home] = roster(page);
      const anonymous = all(home, 'roster-row')[1];
      expect(text(anonymous)).toBe('Anonymer Spieler');
      expect(anonymous.querySelector('a')).toBeNull();
      expect(home.querySelectorAll('a')).toHaveLength(0);
      expect(home.innerHTML).not.toContain('92256481');
    });

    it('names the Kader Heim and Gast while the Spiel cannot be read', async () => {
      const page = await render(
        fakeData(
          async () => {
            throw new BasketballDataError('unavailable', 'DBB: nope');
          },
          async () => report(WITHOUT_STATS, WITHOUT_STATS)
        )
      );

      expect(roster(page).map((k) => text(k.querySelector('h3')))).toEqual([
        'Heim',
        'Gast',
      ]);
    });
  });

  describe('marking a Kind', () => {
    const WASBUETTEL = 313036;
    const GIFHORN = 201500;
    /** Ilvio, a named player of the home Kader. */
    const ILVIO = 91692638;
    /** Delon, a named player of the away Kader. */
    const DELON = 92256481;

    async function withSelection(
      teams: readonly number[],
      children: readonly Child[] = [],
      gameReport: GameReport = report(WITH_STATS, WITHOUT_STATS)
    ): Promise<{
      readonly page: HTMLElement;
      readonly selection: LocalSelection;
      readonly settled: () => Promise<void>;
    }> {
      const selection = new LocalSelection(undefined);
      for (const team of teams) {
        await selection.follow(team);
      }
      for (const { personId, nickname } of children) {
        await selection.mark({ kind: 'named', personId }, nickname);
      }
      const rendered = await renderWith(
        fakeData(
          async () => PLAYED_GAME,
          async () => gameReport
        ),
        selection
      );
      return { ...rendered, selection };
    }

    afterEach(() => {
      // a dialog left open lives outside the page
      document.querySelector('.cdk-overlay-container')?.replaceChildren();
    });

    function rosterOf(page: HTMLElement, team: string): HTMLElement {
      const found = all(page, 'roster').find(
        (roster) => text(roster.querySelector('h3')) === team
      );
      if (found === undefined) {
        throw new Error(`no Kader of ${team}`);
      }
      return found;
    }

    function rowOf(roster: HTMLElement, name: string): HTMLElement {
      const row = all(roster, 'roster-row').find((tr) =>
        text(tr.querySelector('.name'))?.includes(name)
      );
      if (row === undefined) {
        throw new Error(`no line of ${name}`);
      }
      return row;
    }

    function markButtons(roster: HTMLElement): HTMLButtonElement[] {
      return [
        ...roster.querySelectorAll<HTMLButtonElement>(
          'button[aria-label="Als mein Kind markieren"]'
        ),
      ];
    }

    function dialog(): HTMLElement | null {
      return document.querySelector<HTMLElement>('korb-nickname-dialog');
    }

    function button(
      where: ParentNode | null,
      caption: string
    ): HTMLButtonElement {
      const found = [
        ...(where ?? document).querySelectorAll<HTMLButtonElement>('button'),
      ].find((button) => text(button)?.includes(caption));
      if (found === undefined) {
        throw new Error(`no button ${caption}`);
      }
      return found;
    }

    async function enterNickname(
      nickname: string,
      settled: () => Promise<void>
    ): Promise<void> {
      const input = dialog()?.querySelector('input');
      if (!input) {
        throw new Error('no dialog open');
      }
      input.value = nickname;
      input.dispatchEvent(new Event('input'));
      input.form?.requestSubmit();
      await settled();
    }

    it("offers to mark each named player of a followed Team's Kader, no Anonymer Spieler", async () => {
      const { page } = await withSelection([WASBUETTEL]);

      const home = rosterOf(page, 'MTV Wasbüttel');
      expect(markButtons(home)).toHaveLength(1);
      expect(
        rowOf(home, 'Anonymer Spieler').querySelector('button')
      ).toBeNull();
    });

    it('offers no mark while no Team of the Spiel is followed', async () => {
      const { page } = await withSelection([]);

      expect(markButtons(page)).toEqual([]);
    });

    it("offers no mark in the opponent's Kader", async () => {
      const { page } = await withSelection([WASBUETTEL]);

      expect(markButtons(rosterOf(page, 'MTV Gifhorn'))).toEqual([]);
    });

    it('offers marks in both Kader where both Teams are followed', async () => {
      const { page } = await withSelection([GIFHORN, WASBUETTEL]);

      expect(markButtons(rosterOf(page, 'MTV Wasbüttel'))).toHaveLength(1);
      expect(markButtons(rosterOf(page, 'MTV Gifhorn'))).toHaveLength(1);
    });

    it('marks a player as the Kind with a Spitzname, and highlights them with a star', async () => {
      const { page, selection, settled } = await withSelection([WASBUETTEL]);

      markButtons(rosterOf(page, 'MTV Wasbüttel'))[0].click();
      await settled();
      expect(text(dialog())).toContain('Ilvio Mistelgrund');
      await enterNickname('  Ilvi ', settled);

      expect(selection.children()).toEqual([
        { personId: ILVIO, nickname: 'Ilvi' },
      ]);
      const row = rowOf(rosterOf(page, 'MTV Wasbüttel'), 'Ilvio');
      expect(row.hasAttribute('data-child')).toBe(true);
      expect(row.querySelector('mat-icon.star')).not.toBeNull();
      expect(text(part(row, 'roster-nickname'))).toBe('„Ilvi“');
      expect(text(row.querySelector('.name'))).toContain('Mein Kind:');
      expect(markButtons(rosterOf(page, 'MTV Wasbüttel'))).toEqual([]);
    });

    it('marks a Kind without a Spitzname', async () => {
      const { page, selection, settled } = await withSelection([WASBUETTEL]);

      markButtons(rosterOf(page, 'MTV Wasbüttel'))[0].click();
      await settled();
      await enterNickname('', settled);

      expect(selection.children()).toEqual([{ personId: ILVIO }]);
      const row = rowOf(rosterOf(page, 'MTV Wasbüttel'), 'Ilvio');
      expect(part(row, 'roster-nickname')).toBeNull();
    });

    it('marks nobody where the dialog is cancelled', async () => {
      const { page, selection, settled } = await withSelection([WASBUETTEL]);

      markButtons(rosterOf(page, 'MTV Wasbüttel'))[0].click();
      await settled();
      button(dialog(), 'Abbrechen').click();
      await settled();

      expect(selection.children()).toEqual([]);
    });

    it("highlights a marked Kind only in a followed Team's Kader", async () => {
      const { page } = await withSelection(
        [WASBUETTEL],
        [{ personId: DELON, nickname: 'Del' }]
      );

      // Delon plays for the opponent here: not one of Meine Teams
      const away = rosterOf(page, 'MTV Gifhorn');
      expect(rowOf(away, 'Delon').hasAttribute('data-child')).toBe(false);
      expect(part(away, 'roster-nickname')).toBeNull();
    });

    it('highlights the same Kind in the Kader of each followed Team it plays for', async () => {
      const { page } = await withSelection(
        [GIFHORN, WASBUETTEL],
        [{ personId: DELON }, { personId: ILVIO }]
      );

      expect(
        rowOf(rosterOf(page, 'MTV Gifhorn'), 'Delon').hasAttribute('data-child')
      ).toBe(true);
      expect(
        rowOf(rosterOf(page, 'MTV Wasbüttel'), 'Ilvio').hasAttribute(
          'data-child'
        )
      ).toBe(true);
    });

    it("changes a marked Kind's Spitzname from its menu", async () => {
      const { page, selection, settled } = await withSelection(
        [WASBUETTEL],
        [{ personId: ILVIO, nickname: 'Ilvi' }]
      );

      const menu = rowOf(
        rosterOf(page, 'MTV Wasbüttel'),
        'Ilvio'
      ).querySelector<HTMLButtonElement>('[data-qa="child-menu"]');
      expect(menu?.getAttribute('aria-label')).toBe(
        'Mein Kind Ilvio Mistelgrund: Markierung ändern'
      );
      menu?.click();
      await settled();
      button(
        document.querySelector('.mat-mdc-menu-panel'),
        'Spitzname ändern'
      ).click();
      await settled();
      expect(dialog()?.querySelector('input')?.value).toBe('Ilvi');
      await enterNickname('Ilvo', settled);

      expect(selection.children()).toEqual([
        { personId: ILVIO, nickname: 'Ilvo' },
      ]);
      expect(
        text(part(rosterOf(page, 'MTV Wasbüttel'), 'roster-nickname'))
      ).toBe('„Ilvo“');
    });

    it('unmarks a Kind from its menu', async () => {
      const { page, selection, settled } = await withSelection(
        [WASBUETTEL],
        [{ personId: ILVIO }]
      );

      rowOf(rosterOf(page, 'MTV Wasbüttel'), 'Ilvio')
        .querySelector<HTMLButtonElement>('[data-qa="child-menu"]')
        ?.click();
      await settled();
      button(
        document.querySelector('.mat-mdc-menu-panel'),
        'Markierung entfernen'
      ).click();
      await settled();

      expect(selection.children()).toEqual([]);
      expect(markButtons(rosterOf(page, 'MTV Wasbüttel'))).toHaveLength(1);
    });

    it('says so where the mark could not be stored', async () => {
      const { page, selection, settled } = await withSelection([WASBUETTEL]);
      vi.spyOn(selection, 'mark').mockRejectedValue(new Error('voll'));

      markButtons(rosterOf(page, 'MTV Wasbüttel'))[0].click();
      await settled();
      await enterNickname('Ilvi', settled);

      expect(text(part(page, 'child-error'))).toBe(
        'Das ließ sich nicht speichern. Bitte noch einmal versuchen.'
      );
    });

    it('keeps the reload hint where a newer version stored the selection, the controls gone', async () => {
      const teams = signal<readonly number[]>([WASBUETTEL]);
      const { page, settled } = await renderWith(
        fakeData(
          async () => PLAYED_GAME,
          async () => report(WITH_STATS, WITHOUT_STATS)
        ),
        fakeSelection({
          teams,
          mark: async () => {
            // as LocalSelection does: it shows nothing of a newer version
            teams.set([]);
            throw new SelectionTooNewError();
          },
        })
      );

      markButtons(rosterOf(page, 'MTV Wasbüttel'))[0].click();
      await settled();
      await enterNickname('Ilvi', settled);

      expect(markButtons(page)).toEqual([]);
      expect(part(page, 'child-error')?.getAttribute('role')).toBe('alert');
      expect(text(part(page, 'child-error'))).toContain(
        'Bitte die App neu laden.'
      );
    });

    it('closes the Spitzname dialog where the Team was unfollowed meanwhile, and marks nobody', async () => {
      const { page, selection, settled } = await withSelection([WASBUETTEL]);
      const mark = vi.spyOn(selection, 'mark');
      markButtons(rosterOf(page, 'MTV Wasbüttel'))[0].click();
      await settled();
      expect(dialog()).not.toBeNull();

      // another tab unfollows the Team: its Kader offers no mark any more
      await selection.unfollow(WASBUETTEL);
      await settled();

      expect(dialog()).toBeNull();
      expect(mark).not.toHaveBeenCalled();
      expect(selection.children()).toEqual([]);
    });

    it('highlights a Kind in both Kader where both Teams are followed and it is in each', async () => {
      const ilvio = WITH_STATS.entries[0];
      const { page } = await withSelection(
        [WASBUETTEL, GIFHORN],
        [{ personId: ILVIO, nickname: 'Ilvi' }],
        report(WITH_STATS, { ...WITHOUT_STATS, entries: [ilvio] })
      );

      for (const team of ['MTV Wasbüttel', 'MTV Gifhorn']) {
        const row = rowOf(rosterOf(page, team), 'Ilvio');
        expect(row.hasAttribute('data-child')).toBe(true);
        expect(text(part(row, 'roster-nickname'))).toBe('„Ilvi“');
      }
    });
  });

  describe('each part on its own', () => {
    it('shows the Kader while the Spiel fails', async () => {
      const page = await render(
        fakeData(
          async () => {
            throw new BasketballDataError('unavailable', 'DBB: nope');
          },
          async () => report(WITHOUT_STATS, WITHOUT_STATS)
        )
      );

      expect(text(part(page, 'game-error'))).toContain(
        'Der DBB ist gerade nicht erreichbar.'
      );
      expect(all(page, 'roster')).toHaveLength(2);
    });

    it('shows the Spiel while the Spielbericht fails', async () => {
      const page = await render(
        fakeData(
          async () => PLAYED_GAME,
          async () => {
            throw new BasketballDataError('unexpected-shape', 'DBB: nope');
          }
        )
      );

      expect(text(part(page, 'game-result'))).toBe('78:47');
      expect(text(part(page, 'game-report-error'))).toContain(
        'Die Daten des DBB ließen sich nicht lesen.'
      );
      expect(part(page, 'game-report-missing')).toBeNull();
    });

    it('shows the Spiel while the Spielbericht still loads', async () => {
      const page = await render(
        fakeData(
          async () => PLAYED_GAME,
          () => NEVER
        )
      );

      expect(text(part(page, 'game-result'))).toBe('78:47');
      expect(
        page.querySelector(
          'mat-progress-bar[aria-label="Spielbericht wird geladen"]'
        )
      ).not.toBeNull();
    });

    it('says so when the DBB knows no such Spiel', async () => {
      const page = await render(
        fakeData(
          async () => {
            throw new BasketballDataError('not-found', 'DBB: nope');
          },
          async () => {
            throw new BasketballDataError('not-found', 'DBB: nope');
          }
        )
      );

      const message = page.querySelector('[role="alert"]');
      expect(text(message)).toBe('Dieses Spiel kennt der DBB nicht.');
      // the page's heading first, then what went wrong: no heading after it
      const headings = page.querySelectorAll('h1');
      expect(headings).toHaveLength(1);
      expect(
        headings[0].compareDocumentPosition(message as Node) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    });

    it.each([
      ['unknown', 'not-found', 'Dieses Spiel kennt der DBB nicht.'],
      ['unreachable', 'unavailable', 'Der DBB ist gerade nicht erreichbar.'],
    ] as const)(
      'says it once when the Spiel is %s and its Spielbericht fails too',
      async (_case, kind, message) => {
        const page = await render(
          fakeData(
            async () => {
              throw new BasketballDataError(kind, 'DBB: nope');
            },
            async () => {
              throw new BasketballDataError(kind, 'DBB: nope');
            }
          )
        );

        expect(page.textContent?.split(message)).toHaveLength(2);
        expect(part(page, 'game-report-error')).toBeNull();
        expect(
          [...page.querySelectorAll('h2')].map((h2) => text(h2))
        ).not.toContain('Kader');
      }
    );
  });

  it.each(['2861436abc', 'abc', '-1', '0'])(
    'shows no Spiel for the id %s, without asking the DBB',
    async (gameId) => {
      const data = fakeData(
        async () => PLAYED_GAME,
        async () => undefined
      );

      const page = await render(data, gameId);

      expect(text(page.querySelector('[role="alert"]'))).toBe(
        'Dieses Spiel kennt der DBB nicht.'
      );
      expect(text(page.querySelector('h1'))).toBe('Spiel');
      expect(data.game).not.toHaveBeenCalled();
      expect(data.gameReport).not.toHaveBeenCalled();
      expect(part(page, 'game-report-missing')).toBeNull();
    }
  );
});
