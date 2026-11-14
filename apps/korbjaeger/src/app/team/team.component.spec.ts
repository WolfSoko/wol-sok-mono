import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  BasketballDataError,
  type Venue,
  type League,
  type Game,
  type Participant,
  type Standings,
  type Team,
  type TeamSeason,
  type ClubTeams,
} from '@wolsok/feat-shared-basketball-data';
import {
  BASKETBALL_DATA,
  type KorbjaegerData,
} from '../basketball-data/basketball-data.provider';
import { SELECTION } from '../selection/selection';
import { LocalSelection } from '@wolsok/feat-korbjaeger-selection';
import type { KorbReadOptions } from '../basketball-data/reading';
import { TODAY } from '../today';
import { NOW } from '../now';
import { Breadcrumb } from '../navigation/breadcrumb';
import { TeamComponent } from './team.component';

const OUR_TEAM: Team = { id: 313036, name: 'MTV Wasbüttel', clubId: 1837 };

function league(id: number, name: string): League {
  return {
    id,
    name,
    association: { id: 7, name: 'Niedersachsen' },
    ageGroup: 'U12',
    gender: 'mixed',
    division: 'Kreisliga',
  };
}

const FIRST_ROUND = league(54862, 'U12 Vorrunde Nord');
const FRIENDLIES = league(54689, 'Testspiele Braunschweig u12');

function opponent(id: number, name: string): Participant {
  return { kind: 'team', team: { id, name, clubId: id } };
}

const US: Participant = { kind: 'team', team: OUR_TEAM };

function game(overrides: Partial<Game> & Pick<Game, 'id' | 'date'>): Game {
  return {
    leagueId: FIRST_ROUND.id,
    matchday: 1,
    time: '10:00',
    home: US,
    away: opponent(201500, 'MTV Gifhorn'),
    status: { kind: 'scheduled' },
    ...overrides,
  };
}

function standingsRow(rank: number, team: Team): Standings['rows'][number] {
  return {
    rank,
    participant: { kind: 'team', team },
    games: 2,
    wins: 2 - rank + 1,
    losses: rank - 1,
    points: 2 * (2 - rank + 1),
    pointsFor: 100,
    pointsAgainst: 90,
    pointDifference: 10,
  };
}

function season(games: readonly Game[]): TeamSeason {
  return {
    team: OUR_TEAM,
    club: { id: 1837, name: 'MTV Wasbüttel' },
    leagues: [FRIENDLIES, FIRST_ROUND],
    games,
  };
}

type TeamGamesRead = KorbjaegerData['teamGames'];
type StandingsRead = KorbjaegerData['standings'];
type GameRead = KorbjaegerData['game'];
type ClubTeamsRead = KorbjaegerData['clubTeams'];

/** The day the specs run on: after the last Spiel of the fixtures below. */
const TODAY_IN_SPEC = '2026-11-08';
/** Noon of `TODAY_IN_SPEC` in Germany. */
const NOW_IN_SPEC = Date.parse('2026-11-08T12:00:00+01:00');
const TWO_HOURS = 2 * 60 * 60_000;

/** An empty Tabelle of Liga `leagueId`. */
const noRows: StandingsRead = async (leagueId) => ({
  league:
    [FRIENDLIES, FIRST_ROUND].find(({ id }) => id === leagueId) ?? FIRST_ROUND,
  rows: [],
});

const SCHOOL_GYM: Venue = {
  name: 'Schulsporthalle',
  street: 'Schulstr. 12',
  postcode: '38553',
  town: 'Wasbüttel',
};

/** A Spiel's details, played in the Schulsporthalle. */
const inTheSchoolGym: GameRead = async (gameId) => ({
  game: game({ id: gameId, date: '2026-11-21' }),
  league: FIRST_ROUND,
  venue: SCHOOL_GYM,
  quarters: [],
  overtimes: [],
});

/** The Verein's Teams of its recent Spiele: ours and two others. */
const OUR_CLUB: ClubTeams = {
  club: { id: 1837, name: 'MTV Wasbüttel' },
  teams: [
    { team: OUR_TEAM, leagues: [FIRST_ROUND] },
    {
      team: { id: 317618, name: 'MTV Wasbüttel 2', clubId: 1837 },
      leagues: [league(54900, 'Regionsvorrunde Nordwest mu14')],
    },
    {
      team: { id: 270037, name: 'MTV Wasbüttel', clubId: 1837 },
      leagues: [league(54901, 'Regionsliga Braunschweig mu16')],
    },
  ],
};

/** A Verein whose recent Spiele show no Team. */
const WITHOUT_TEAMS: ClubTeamsRead = async () => ({
  club: OUR_CLUB.club,
  teams: [],
});

/**
 * `KorbjaegerData` answering `teamGames` with `read`, Tabellen empty,
 * every Spiel in the Schulsporthalle, the Verein without other Teams.
 */
function fakeData(
  read: TeamGamesRead,
  standings: StandingsRead = noRows,
  details: GameRead = inTheSchoolGym,
  clubTeams: ClubTeamsRead = WITHOUT_TEAMS
): {
  readonly teamGames: ReturnType<typeof vi.fn<TeamGamesRead>>;
  readonly standings: ReturnType<typeof vi.fn<StandingsRead>>;
  readonly game: ReturnType<typeof vi.fn<GameRead>>;
  readonly clubTeams: ReturnType<typeof vi.fn<ClubTeamsRead>>;
} {
  return {
    teamGames: vi.fn<TeamGamesRead>(read),
    standings: vi.fn<StandingsRead>(standings),
    game: vi.fn<GameRead>(details),
    clubTeams: vi.fn<ClubTeamsRead>(clubTeams),
  };
}

function providers(
  data: ReturnType<typeof fakeData>,
  today: WritableSignal<string> = signal(TODAY_IN_SPEC)
) {
  return [
    provideRouter([]),
    { provide: BASKETBALL_DATA, useValue: data },
    { provide: TODAY, useValue: today },
    { provide: NOW, useValue: signal(NOW_IN_SPEC) },
    // in memory: nothing reaches the device's storage
    { provide: SELECTION, useFactory: () => new LocalSelection(undefined) },
  ];
}

async function render(
  data: ReturnType<typeof fakeData>,
  teamId = '313036'
): Promise<HTMLElement> {
  TestBed.configureTestingModule({ providers: providers(data) });
  const fixture = TestBed.createComponent(TeamComponent);
  fixture.componentRef.setInput('teamId', teamId);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

function gameRows(page: HTMLElement): HTMLElement[] {
  return [...page.querySelectorAll<HTMLElement>('[data-qa="game"]')];
}

function field(row: HTMLElement, name: string): string | undefined {
  return row
    .querySelector(`[data-qa="game-${name}"]`)
    ?.textContent?.replace(/\s+/g, ' ')
    .trim();
}

describe('TeamComponent', () => {
  describe('the last good data', () => {
    it("shows the Team's last good Spiele with their age where the read fell back on them", async () => {
      const page = await render(
        fakeData(async (_team, options?: KorbReadOptions) => {
          options?.reading?.replaced({
            storedAt: NOW_IN_SPEC - TWO_HOURS,
            reason: 'no-internet',
          });
          return season([game({ id: 1, date: '2026-09-20' })]);
        })
      );

      expect(
        page.querySelector('[data-qa="team-as-of"]')?.textContent
      ).toContain('Offline · Stand: vor 2 Std.');
      expect(gameRows(page)).toHaveLength(1);
      expect(page.querySelector('[role="alert"]')).toBeNull();
    });

    it("labels the Team's head with the oldest Stand of what it shows, the next Spiel's Halle too", async () => {
      const page = await render(
        fakeData(
          async () => season([game({ id: 1, date: '2026-11-14' })]),
          noRows,
          async (gameId, options?: KorbReadOptions) => {
            options?.reading?.replaced({
              storedAt: NOW_IN_SPEC - TWO_HOURS,
              reason: 'unavailable',
            });
            return inTheSchoolGym(gameId);
          }
        )
      );

      expect(
        page.querySelector('[data-qa="team-as-of"]')?.textContent
      ).toContain('DBB nicht erreichbar · Stand: vor 2 Std.');
    });

    it("labels the Verein's other Teams with their own Stand", async () => {
      const page = await render(
        fakeData(
          async () => season([game({ id: 1, date: '2026-11-14' })]),
          noRows,
          inTheSchoolGym,
          async (club, options?: KorbReadOptions) => {
            options?.reading?.replaced({
              storedAt: NOW_IN_SPEC - TWO_HOURS,
              reason: 'no-internet',
            });
            return WITHOUT_TEAMS(club);
          }
        )
      );

      expect(
        page.querySelector('[data-qa="club-as-of"]')?.textContent
      ).toContain('Offline · Stand: vor 2 Std.');
      expect(
        page.querySelector('[data-qa="team-as-of"] [data-qa="as-of"]')
      ).toBeNull();
    });

    it('labels no Stand for Spiele just read', async () => {
      const page = await render(fakeData(async () => season([])));

      expect(page.querySelector('[data-qa="as-of"]')).toBeNull();
    });
  });

  it("reads the Team of the page's id", async () => {
    const data = fakeData(async () => season([]));

    await render(data, '313036');

    expect(data.teamGames).toHaveBeenCalledWith(
      313036,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('names the Team', async () => {
    const page = await render(fakeData(async () => season([])));

    expect(page.querySelector('h1')?.textContent).toContain('MTV Wasbüttel');
  });

  it("lists every Spiel of every Liga in the port's order, by date", async () => {
    // the port promises date order; the page shows what it gets as it is
    const page = await render(
      fakeData(async () =>
        season([
          game({ id: 1, date: '2026-08-29', leagueId: FRIENDLIES.id }),
          game({ id: 2, date: '2026-09-20', time: '15:00' }),
          game({ id: 3, date: '2026-09-20', time: '09:00' }),
          game({ id: 4, date: '2026-09-12' }),
        ])
      )
    );

    expect(gameRows(page).map((row) => field(row, 'date'))).toEqual([
      'Sa., 29.08.2026',
      'So., 20.09.2026',
      'So., 20.09.2026',
      'Sa., 12.09.2026',
    ]);
    expect(gameRows(page).map((row) => field(row, 'time'))).toEqual([
      '10:00',
      '15:00',
      '09:00',
      '10:00',
    ]);
    expect(gameRows(page).map((row) => field(row, 'league'))).toEqual([
      FRIENDLIES.name,
      FIRST_ROUND.name,
      FIRST_ROUND.name,
      FIRST_ROUND.name,
    ]);
  });

  it('shows no time where the DBB has none', async () => {
    const page = await render(
      fakeData(async () =>
        season([game({ id: 1, date: '2026-09-12', time: undefined })])
      )
    );

    expect(field(gameRows(page)[0], 'time')).toBeUndefined();
  });

  it('tells home from away and names the opponent', async () => {
    const page = await render(
      fakeData(async () =>
        season([
          game({ id: 1, date: '2026-09-12', away: opponent(2, 'MTV Gifhorn') }),
          game({
            id: 2,
            date: '2026-09-20',
            home: opponent(3, 'SV Groß Oesingen'),
            away: US,
          }),
        ])
      )
    );

    const [home, away] = gameRows(page);
    expect(field(home, 'home-or-away')).toBe('Heim');
    expect(field(home, 'opponent')).toBe('MTV Gifhorn');
    expect(field(away, 'home-or-away')).toBe('Auswärts');
    expect(field(away, 'opponent')).toBe('SV Groß Oesingen');
  });

  it('names both sides of a Spiel the DBB lists without the Team', async () => {
    const page = await render(
      fakeData(async () =>
        season([
          game({
            id: 1,
            date: '2026-09-12',
            home: opponent(2, 'MTV Gifhorn'),
            away: opponent(3, 'SV Groß Oesingen'),
          }),
        ])
      )
    );

    expect(field(gameRows(page)[0], 'home-or-away')).toBeUndefined();
    expect(field(gameRows(page)[0], 'opponent')).toBe(
      'MTV Gifhorn – SV Groß Oesingen'
    );
  });

  it('names an opponent the Liga has yet to settle by its slot', async () => {
    const page = await render(
      fakeData(async () =>
        season([
          game({
            id: 1,
            date: '2026-12-05',
            away: { kind: 'open', label: 'Nord 1. Platz' },
          }),
        ])
      )
    );

    expect(field(gameRows(page)[0], 'opponent')).toBe('Nord 1. Platz');
  });

  it('shows the result, home first, once played', async () => {
    const page = await render(
      fakeData(async () =>
        season([
          game({
            id: 1,
            date: '2026-09-12',
            home: opponent(3, 'TuS Müden-Dieckhorst'),
            away: US,
            status: {
              kind: 'played',
              result: { home: 46, away: 99 },
              confirmed: true,
            },
          }),
          game({ id: 2, date: '2026-11-21' }),
        ])
      )
    );

    const [played, scheduled] = gameRows(page);
    expect(field(played, 'result')).toBe('46:99');
    expect(field(scheduled, 'result')).toBeUndefined();
  });

  it('marks a result the Verband has not confirmed yet as vorläufig', async () => {
    const page = await render(
      fakeData(async () =>
        season([
          game({
            id: 1,
            date: '2026-09-12',
            status: {
              kind: 'played',
              result: { home: 99, away: 46 },
              confirmed: false,
            },
          }),
          game({
            id: 2,
            date: '2026-09-19',
            status: {
              kind: 'played',
              result: { home: 60, away: 50 },
              confirmed: true,
            },
          }),
        ])
      )
    );

    const [provisional, confirmed] = gameRows(page);
    expect(field(provisional, 'outcome')).toBe('Sieg');
    expect(field(provisional, 'provisional')).toBe('vorläufig');
    expect(field(confirmed, 'provisional')).toBeUndefined();
  });

  it('shows a result the DBB never confirms (BBL, ProA, ProB) as final', async () => {
    const bbl: League = {
      ...league(55802, '1. Bundesliga (easyCredit BBL)'),
      association: { id: 100, name: 'Bundesligen' },
      resultsNeverConfirmed: true,
    };
    const unconfirmed = (id: number, leagueId: number): Game =>
      game({
        id,
        leagueId,
        date: `2026-09-1${id}`,
        status: {
          kind: 'played',
          result: { home: 99, away: 46 },
          confirmed: false,
        },
      });
    const page = await render(
      fakeData(async () => ({
        ...season([unconfirmed(1, bbl.id), unconfirmed(2, FIRST_ROUND.id)]),
        leagues: [bbl, FIRST_ROUND],
      }))
    );

    const [inTheBbl, inTheFirstRound] = gameRows(page);
    expect(field(inTheBbl, 'result')).toBe('99:46');
    expect(field(inTheBbl, 'outcome')).toBe('Sieg');
    expect(field(inTheBbl, 'provisional')).toBeUndefined();
    expect(field(inTheFirstRound, 'provisional')).toBe('vorläufig');
  });

  it('says in words how each decided Spiel ended for the Team', async () => {
    const played = (home: number, away: number) =>
      ({
        kind: 'played',
        result: { home, away },
        confirmed: true,
      }) as const;
    const page = await render(
      fakeData(async () =>
        season([
          game({
            id: 1,
            date: '2026-09-12',
            home: opponent(3, 'TuS Müden-Dieckhorst'),
            away: US,
            status: played(46, 99),
          }),
          game({ id: 2, date: '2026-09-19', status: played(40, 52) }),
          game({
            id: 3,
            date: '2026-09-26',
            status: { kind: 'forfeited', forfeitedBy: ['home'] },
          }),
          game({ id: 4, date: '2026-11-21' }),
        ])
      )
    );

    expect(gameRows(page).map((row) => field(row, 'outcome'))).toEqual([
      'Sieg',
      'Niederlage',
      'Niederlage',
      undefined,
    ]);
  });

  it('marks a cancelled Spiel', async () => {
    const page = await render(
      fakeData(async () =>
        season([
          game({ id: 1, date: '2026-10-03', status: { kind: 'cancelled' } }),
        ])
      )
    );

    expect(field(gameRows(page)[0], 'irregularity')).toBe('abgesagt');
    expect(field(gameRows(page)[0], 'result')).toBeUndefined();
  });

  it('marks a forfeited Spiel, with its result where there is one', async () => {
    const page = await render(
      fakeData(async () =>
        season([
          game({
            id: 1,
            date: '2026-10-03',
            status: {
              kind: 'forfeited',
              forfeitedBy: ['away'],
              result: { home: 20, away: 0 },
            },
          }),
          game({
            id: 2,
            date: '2026-10-10',
            status: { kind: 'forfeited', forfeitedBy: [] },
          }),
        ])
      )
    );

    const [withResult, withoutResult] = gameRows(page);
    expect(field(withResult, 'irregularity')).toBe('kampflos');
    expect(field(withResult, 'result')).toBe('20:0');
    expect(field(withoutResult, 'irregularity')).toBe('kampflos');
    expect(field(withoutResult, 'result')).toBeUndefined();
  });

  it("opens each Spiel's page", async () => {
    const page = await render(
      fakeData(async () =>
        season([
          game({ id: 2861436, date: '2026-09-20' }),
          game({ id: 2861439, date: '2026-09-25' }),
        ])
      )
    );

    expect(
      gameRows(page).map((row) => row.closest('a')?.getAttribute('href'))
    ).toEqual(['/spiel/2861436', '/spiel/2861439']);
  });

  describe('the next Spiel', () => {
    const WITH_NEXT = season([
      game({
        id: 1,
        date: '2026-10-03',
        status: {
          kind: 'played',
          result: { home: 78, away: 47 },
          confirmed: true,
        },
      }),
      game({ id: 2, date: '2026-11-21', time: '11:00' }),
      game({ id: 3, date: '2026-11-28' }),
    ]);

    function next(page: HTMLElement): HTMLElement | null {
      return page.querySelector('[data-qa="team-next"]');
    }

    it('shows it with its Halle and a link that opens navigation', async () => {
      const page = await render(fakeData(async () => WITH_NEXT));

      const block = next(page);
      expect(block?.textContent).toContain('Nächstes Spiel');
      expect(block?.textContent).toContain('Sa., 21.11.2026');
      expect(
        block?.querySelector('[data-qa="venue-name"]')?.textContent?.trim()
      ).toBe('Schulsporthalle');
      const navigation = block?.querySelector('[data-qa="venue-navigation"]');
      expect(navigation?.getAttribute('target')).toBe('_blank');
      expect(navigation?.getAttribute('rel')).toBe('noopener');
      expect(navigation?.getAttribute('href')).toBe(
        'https://www.google.com/maps/search/?api=1&query=Schulsporthalle%2C%20Schulstr.%2012%2C%2038553%20Wasb%C3%BCttel'
      );
      expect(block?.querySelector('a[href="/spiel/2"]')?.textContent).toContain(
        'MTV Gifhorn'
      );
    });

    it("reads only the next Spiel's Halle", async () => {
      const data = fakeData(async () => WITH_NEXT);

      await render(data);

      expect(data.game.mock.calls.map(([gameId]) => gameId)).toEqual([2]);
    });

    it('shows none and reads no Halle once every Spiel is played', async () => {
      const data = fakeData(async () => season([WITH_NEXT.games[0]]));

      const page = await render(data);

      expect(next(page)).toBeNull();
      expect(data.game).not.toHaveBeenCalled();
    });

    it('keeps the Spiele when its Halle cannot be read', async () => {
      const page = await render(
        fakeData(
          async () => WITH_NEXT,
          noRows,
          async () => {
            throw new BasketballDataError('unavailable', 'DBB: nope');
          }
        )
      );

      expect(
        next(page)?.querySelector('[data-qa="venue-error"]')?.textContent
      ).toContain('Der DBB ist gerade nicht erreichbar.');
      expect(gameRows(page)).toHaveLength(3);
      expect(page.querySelectorAll('[role="alert"]')).toHaveLength(0);
    });
  });

  it('offers to follow the Team', async () => {
    const page = await render(fakeData(async () => season([])));

    expect(
      page.querySelector('[data-qa="follow-team"]')?.textContent
    ).toContain('Team folgen');
  });

  it('offers no Team to follow for an id the DBB does not know', async () => {
    const page = await render(
      fakeData(async () => {
        throw new BasketballDataError('not-found', 'DBB: nope');
      })
    );

    expect(page.querySelector('[data-qa="follow-team"]')).toBeNull();
  });

  it('offers to unfollow a followed Team whose read fails', async () => {
    const selection = new LocalSelection(undefined);
    await selection.follow(313036);
    TestBed.configureTestingModule({
      providers: [
        ...providers(
          fakeData(async () => {
            throw new BasketballDataError('not-found', 'DBB: nope');
          })
        ),
        { provide: SELECTION, useValue: selection },
      ],
    });
    const fixture = TestBed.createComponent(TeamComponent);
    fixture.componentRef.setInput('teamId', '313036');
    await fixture.whenStable();
    const button = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-qa="follow-team"]'
    ) as HTMLButtonElement | null;
    expect(button?.textContent).toContain('Nicht mehr folgen');

    button?.click();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();

    expect(selection.teams()).toEqual([]);
  });

  it('names the Team in the breadcrumb, below the overview', async () => {
    await render(fakeData(async () => season([])));

    const levels = TestBed.inject(Breadcrumb).levels();
    expect(levels.map((level) => level.title)).toEqual([
      'Korbjäger',
      'MTV Wasbüttel',
    ]);
  });

  it("names the page 'Team' in the breadcrumb until the Team is read", async () => {
    TestBed.configureTestingModule({
      providers: providers(
        fakeData(() => new Promise<TeamSeason>(() => undefined))
      ),
    });
    const fixture = TestBed.createComponent(TeamComponent);
    fixture.componentRef.setInput('teamId', '313036');
    fixture.detectChanges();

    expect(TestBed.inject(Breadcrumb).levels().at(-1)?.title).toBe('Team');
  });

  it('says so when the Team has no Spiele', async () => {
    const page = await render(fakeData(async () => season([])));

    expect(page.textContent).toContain('Noch keine Spiele in dieser Saison.');
  });

  it('shows that it is loading', async () => {
    TestBed.configureTestingModule({
      providers: providers(
        fakeData(() => new Promise<TeamSeason>(() => undefined))
      ),
    });
    const fixture = TestBed.createComponent(TeamComponent);
    fixture.componentRef.setInput('teamId', '313036');
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('mat-progress-bar')).not.toBeNull();
  });

  it.each([
    ['not-found', 'Dieses Team kennt der DBB nicht.'],
    ['offline', 'Keine Verbindung. Internet oder Server nicht erreichbar.'],
    ['unavailable', 'Der DBB ist gerade nicht erreichbar.'],
    ['unexpected-shape', 'Die Daten des DBB ließen sich nicht lesen.'],
  ] as const)('explains a %s error', async (kind, text) => {
    const page = await render(
      fakeData(async () => {
        throw new BasketballDataError(kind, 'DBB: nope');
      })
    );

    expect(page.querySelector('[role="alert"]')?.textContent).toContain(text);
    expect(gameRows(page)).toEqual([]);
  });

  it.each(['313036abc', '-1', '0'])(
    'shows no Team for the id %s, without asking the DBB',
    async (teamId) => {
      const data = fakeData(async () => season([]));

      const page = await render(data, teamId);

      expect(page.querySelector('[role="alert"]')?.textContent).toContain(
        'Dieses Team kennt der DBB nicht.'
      );
      expect(data.teamGames).not.toHaveBeenCalled();
    }
  );

  it('cancels the read of a Team the page has left', async () => {
    const data = fakeData(() => new Promise<TeamSeason>(() => undefined));
    TestBed.configureTestingModule({ providers: providers(data) });
    const fixture = TestBed.createComponent(TeamComponent);
    fixture.componentRef.setInput('teamId', '313036');
    fixture.detectChanges();
    const first = data.teamGames.mock.calls[0][1]?.signal;

    fixture.componentRef.setInput('teamId', '201500');
    fixture.detectChanges();

    expect(data.teamGames).toHaveBeenLastCalledWith(
      201500,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(first?.aborted).toBe(true);
  });
  describe('Tabellen', () => {
    const TWO_LEAGUES = season([
      game({ id: 1, date: '2026-08-29', leagueId: FRIENDLIES.id }),
      game({ id: 2, date: '2026-09-12' }),
      game({ id: 3, date: '2026-11-08' }),
    ]);

    function standings(page: HTMLElement): HTMLElement[] {
      return [...page.querySelectorAll<HTMLElement>('[data-qa="standings"]')];
    }

    function heading(standings: HTMLElement): string | undefined {
      return standings.querySelector('h3')?.textContent?.trim();
    }

    const FIRST_ROUND_STANDINGS: Standings = {
      league: FIRST_ROUND,
      rows: [
        standingsRow(1, { id: 201500, name: 'MTV Gifhorn', clubId: 201500 }),
        standingsRow(2, OUR_TEAM),
      ],
    };

    it('shows one Tabelle per Liga of its Spiele, the current Liga first', async () => {
      const data = fakeData(async () => TWO_LEAGUES);

      const page = await render(data);

      expect(standings(page).map(heading)).toEqual([
        FIRST_ROUND.name,
        FRIENDLIES.name,
      ]);
      expect(data.standings.mock.calls.map(([leagueId]) => leagueId)).toEqual([
        FIRST_ROUND.id,
        FRIENDLIES.id,
      ]);
    });

    it('puts the next Liga first once the day of the last Spiel of the current one has passed', async () => {
      const today = signal('2026-11-08');
      TestBed.configureTestingModule({
        providers: providers(
          fakeData(async () =>
            season([
              game({ id: 1, date: '2026-08-29', leagueId: FRIENDLIES.id }),
              game({ id: 2, date: '2026-11-08' }),
              game({ id: 3, date: '2026-11-21', leagueId: FRIENDLIES.id }),
            ])
          ),
          today
        ),
      });
      const fixture = TestBed.createComponent(TeamComponent);
      fixture.componentRef.setInput('teamId', '313036');
      await fixture.whenStable();
      const page = fixture.nativeElement as HTMLElement;
      expect(standings(page).map(heading)).toEqual([
        FIRST_ROUND.name,
        FRIENDLIES.name,
      ]);

      today.set('2026-11-09');
      await fixture.whenStable();

      expect(standings(page).map(heading)).toEqual([
        FRIENDLIES.name,
        FIRST_ROUND.name,
      ]);
    });

    it('highlights the Team in its Tabelle', async () => {
      const page = await render(
        fakeData(
          async () => TWO_LEAGUES,
          async (leagueId) =>
            leagueId === FIRST_ROUND.id
              ? FIRST_ROUND_STANDINGS
              : { league: FRIENDLIES, rows: [] }
        )
      );

      const own = page.querySelector('[aria-current="true"]');
      expect(own?.textContent).toContain('MTV Wasbüttel');
      expect(own?.textContent).toContain('(dein Team)');
    });

    it('keeps the Spiele and the other Tabelle when one Tabelle fails', async () => {
      const page = await render(
        fakeData(
          async () => TWO_LEAGUES,
          async (leagueId) => {
            if (leagueId === FRIENDLIES.id) {
              throw new BasketballDataError('unavailable', 'DBB: nope');
            }
            return FIRST_ROUND_STANDINGS;
          }
        )
      );

      expect(gameRows(page)).toHaveLength(3);
      const [firstRound, friendlies] = standings(page);
      expect(
        firstRound.querySelectorAll('[data-qa="standings-row"]')
      ).toHaveLength(2);
      expect(
        friendlies.querySelector('[data-qa="standings-error"]')?.textContent
      ).toContain('Der DBB ist gerade nicht erreichbar.');
    });

    it('raises no alert per Tabelle when the DBB fails them all', async () => {
      const page = await render(
        fakeData(
          async () => TWO_LEAGUES,
          async () => {
            throw new BasketballDataError('unavailable', 'DBB: nope');
          }
        )
      );

      expect(page.querySelectorAll('[data-qa="standings-error"]')).toHaveLength(
        2
      );
      expect(page.querySelectorAll('[role="alert"]')).toHaveLength(0);
    });

    it('shows no Tabelle for a Team without Spiele', async () => {
      const data = fakeData(async () => season([]));

      const page = await render(data);

      expect(standings(page)).toEqual([]);
      expect(data.standings).not.toHaveBeenCalled();
    });
  });

  describe('weitere Teams des Vereins', () => {
    const WITH_CLUB = (games: readonly Game[]) =>
      fakeData(
        async () => season(games),
        noRows,
        inTheSchoolGym,
        async () => OUR_CLUB
      );

    function fieldIn(row: HTMLElement, qa: string): string | undefined {
      return row.querySelector(`[data-qa="${qa}"]`)?.textContent?.trim();
    }

    function clubTeams(page: HTMLElement): HTMLElement[] {
      return [...page.querySelectorAll<HTMLElement>('[data-qa="club-team"]')];
    }

    it("reads the Teams of the Team's Verein", async () => {
      const data = WITH_CLUB([]);

      await render(data);

      expect(data.clubTeams).toHaveBeenCalledWith(
        1837,
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('lists the other Teams with their Ligen, each linking to its page, the Team itself left out', async () => {
      const page = await render(WITH_CLUB([]));

      expect(
        clubTeams(page).map((row) => [
          fieldIn(row, 'club-team-name'),
          fieldIn(row, 'club-team-leagues'),
        ])
      ).toEqual([
        ['MTV Wasbüttel 2', 'Regionsvorrunde Nordwest mu14'],
        ['MTV Wasbüttel', 'Regionsliga Braunschweig mu16'],
      ]);
      expect(
        clubTeams(page).map((row) =>
          row.querySelector('a')?.getAttribute('href')
        )
      ).toEqual(['/team/317618', '/team/270037']);
    });

    it('follows another Team of the Verein from its line', async () => {
      const selection = new LocalSelection(undefined);
      TestBed.configureTestingModule({
        providers: [
          ...providers(WITH_CLUB([])),
          { provide: SELECTION, useValue: selection },
        ],
      });
      const fixture = TestBed.createComponent(TeamComponent);
      fixture.componentRef.setInput('teamId', '313036');
      await fixture.whenStable();
      const page = fixture.nativeElement as HTMLElement;

      const button = clubTeams(page)[0].querySelector('button');
      expect(button?.getAttribute('aria-label')).toBe(
        'Team folgen: MTV Wasbüttel 2'
      );
      button?.click();
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();

      expect(selection.teams()).toEqual([317618]);
      expect(button?.getAttribute('aria-label')).toBe(
        'Nicht mehr folgen: MTV Wasbüttel 2'
      );
    });

    it('reads the Verein once when switching to a sibling Team of it', async () => {
      const siblings: Team = {
        id: 317618,
        name: 'MTV Wasbüttel 2',
        clubId: 1837,
      };
      const data = fakeData(
        async (teamId) => ({
          ...season([]),
          team: teamId === siblings.id ? siblings : OUR_TEAM,
        }),
        noRows,
        inTheSchoolGym,
        async () => OUR_CLUB
      );
      TestBed.configureTestingModule({ providers: providers(data) });
      const fixture = TestBed.createComponent(TeamComponent);
      fixture.componentRef.setInput('teamId', '313036');
      await fixture.whenStable();

      fixture.componentRef.setInput('teamId', String(siblings.id));
      await fixture.whenStable();

      const page = fixture.nativeElement as HTMLElement;
      expect(page.querySelector('h1')?.textContent).toContain(
        'MTV Wasbüttel 2'
      );
      expect(data.clubTeams).toHaveBeenCalledTimes(1);
      expect(
        clubTeams(page).map((row) =>
          row.querySelector('a')?.getAttribute('href')
        )
      ).toEqual(['/team/313036', '/team/270037']);
    });

    it('says so where the Verein shows no other Team', async () => {
      const page = await render(fakeData(async () => season([])));

      expect(clubTeams(page)).toEqual([]);
      expect(
        page.querySelector('[data-qa="club-teams"]')?.textContent
      ).toContain('Keine weiteren Teams');
    });

    it('keeps the Spiele when the Verein cannot be read', async () => {
      const page = await render(
        fakeData(
          async () => season([game({ id: 1, date: '2026-11-21' })]),
          noRows,
          inTheSchoolGym,
          async () => {
            throw new BasketballDataError('unavailable', 'DBB: nope');
          }
        )
      );

      expect(gameRows(page)).toHaveLength(1);
      expect(
        page.querySelector('[data-qa="club-teams-error"]')?.textContent
      ).toContain('Der DBB ist gerade nicht erreichbar.');
      expect(page.querySelectorAll('[role="alert"]')).toHaveLength(0);
    });
  });

  describe('the end of the Saison', () => {
    const PLAYED_GAME: Game['status'] = {
      kind: 'played',
      result: { home: 78, away: 47 },
      confirmed: true,
    };

    function withLastGameOn(date: string) {
      return fakeData(
        async () => season([game({ id: 1, date, status: PLAYED_GAME })]),
        noRows,
        inTheSchoolGym,
        async () => OUR_CLUB
      );
    }

    function hint(page: HTMLElement): HTMLElement | null {
      return page.querySelector('[data-qa="season-over"]');
    }

    it("asks whether the Saison is over and suggests the Verein's current Teams", async () => {
      // more than two weeks before 8 November
      const page = await render(withLastGameOn('2026-10-24'));

      expect(hint(page)?.textContent).toContain(
        'Keine Spiele mehr angesetzt. Ist die Saison vorbei?'
      );
      expect(hint(page)?.textContent).not.toContain('Saison ist vorbei');
      expect(
        [
          ...(hint(page)?.querySelectorAll('[data-qa="club-team-name"]') ?? []),
        ].map((name) => name.textContent?.trim())
      ).toEqual(['MTV Wasbüttel 2', 'MTV Wasbüttel']);
      expect(page.querySelectorAll('[data-qa="club-teams"]')).toHaveLength(1);
    });

    it('says nothing exactly two weeks after the last Spiel', async () => {
      const page = await render(withLastGameOn('2026-10-25'));

      expect(hint(page)).toBeNull();
      expect(page.querySelector('[data-qa="club-teams"]')).not.toBeNull();
    });

    it('says nothing while a Spiel is still to come', async () => {
      const page = await render(
        fakeData(async () =>
          season([
            game({ id: 1, date: '2026-09-20', status: PLAYED_GAME }),
            game({ id: 2, date: '2026-12-05' }),
          ])
        )
      );

      expect(hint(page)).toBeNull();
    });
  });
});
