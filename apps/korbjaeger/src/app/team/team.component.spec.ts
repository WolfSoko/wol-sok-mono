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
import { AUSWAHL } from '../auswahl/auswahl';
import { LocalSelection } from '@wolsok/feat-korbjaeger-selection';
import type { KorbReadOptions } from '../basketball-data/lesung';
import { HEUTE } from '../heute';
import { JETZT } from '../jetzt';
import { Breadcrumb } from '../navigation/breadcrumb';
import { TeamComponent } from './team.component';

const UNSER_TEAM: Team = { id: 313036, name: 'MTV Wasbüttel', clubId: 1837 };

function liga(id: number, name: string): League {
  return {
    id,
    name,
    association: { id: 7, name: 'Niedersachsen' },
    ageGroup: 'U12',
    gender: 'mixed',
    division: 'Kreisliga',
  };
}

const VORRUNDE = liga(54862, 'U12 Vorrunde Nord');
const TESTSPIELE = liga(54689, 'Testspiele Braunschweig u12');

function gegner(id: number, name: string): Participant {
  return { kind: 'team', team: { id, name, clubId: id } };
}

const UNS: Participant = { kind: 'team', team: UNSER_TEAM };

function spiel(overrides: Partial<Game> & Pick<Game, 'id' | 'date'>): Game {
  return {
    leagueId: VORRUNDE.id,
    matchday: 1,
    time: '10:00',
    home: UNS,
    away: gegner(201500, 'MTV Gifhorn'),
    status: { kind: 'scheduled' },
    ...overrides,
  };
}

function tabellenZeile(rang: number, team: Team): Standings['rows'][number] {
  return {
    rank: rang,
    participant: { kind: 'team', team },
    games: 2,
    wins: 2 - rang + 1,
    losses: rang - 1,
    points: 2 * (2 - rang + 1),
    pointsFor: 100,
    pointsAgainst: 90,
    pointDifference: 10,
  };
}

function saison(spiele: readonly Game[]): TeamSeason {
  return {
    team: UNSER_TEAM,
    club: { id: 1837, name: 'MTV Wasbüttel' },
    leagues: [TESTSPIELE, VORRUNDE],
    games: spiele,
  };
}

type TeamSpieleRead = KorbjaegerData['teamGames'];
type TabelleRead = KorbjaegerData['standings'];
type SpielRead = KorbjaegerData['game'];
type VereinsTeamsRead = KorbjaegerData['clubTeams'];

/** The day the specs run on: after the last Spiel of the fixtures below. */
const HEUTE_IM_SPEC = '2026-11-08';
/** Noon of `HEUTE_IM_SPEC` in Germany. */
const JETZT_IM_SPEC = Date.parse('2026-11-08T12:00:00+01:00');
const ZWEI_STUNDEN = 2 * 60 * 60_000;

/** An empty Tabelle of Liga `ligaId`. */
const keineZeilen: TabelleRead = async (ligaId) => ({
  league: [TESTSPIELE, VORRUNDE].find(({ id }) => id === ligaId) ?? VORRUNDE,
  rows: [],
});

const SCHULSPORTHALLE: Venue = {
  name: 'Schulsporthalle',
  street: 'Schulstr. 12',
  postcode: '38553',
  town: 'Wasbüttel',
};

/** A Spiel's details, played in the Schulsporthalle. */
const inDerSchulsporthalle: SpielRead = async (spielId) => ({
  game: spiel({ id: spielId, date: '2026-11-21' }),
  league: VORRUNDE,
  venue: SCHULSPORTHALLE,
  quarters: [],
  overtimes: [],
});

/** The Verein's Teams of its recent Spiele: ours and two others. */
const UNSER_VEREIN: ClubTeams = {
  club: { id: 1837, name: 'MTV Wasbüttel' },
  teams: [
    { team: UNSER_TEAM, leagues: [VORRUNDE] },
    {
      team: { id: 317618, name: 'MTV Wasbüttel 2', clubId: 1837 },
      leagues: [liga(54900, 'Regionsvorrunde Nordwest mu14')],
    },
    {
      team: { id: 270037, name: 'MTV Wasbüttel', clubId: 1837 },
      leagues: [liga(54901, 'Regionsliga Braunschweig mu16')],
    },
  ],
};

/** A Verein whose recent Spiele show no Team. */
const OHNE_TEAMS: VereinsTeamsRead = async () => ({
  club: UNSER_VEREIN.club,
  teams: [],
});

/**
 * `KorbjaegerData` answering `teamGames` with `read`, Tabellen empty,
 * every Spiel in the Schulsporthalle, the Verein without other Teams.
 */
function fakeData(
  read: TeamSpieleRead,
  standings: TabelleRead = keineZeilen,
  details: SpielRead = inDerSchulsporthalle,
  clubTeams: VereinsTeamsRead = OHNE_TEAMS
): {
  readonly teamGames: ReturnType<typeof vi.fn<TeamSpieleRead>>;
  readonly standings: ReturnType<typeof vi.fn<TabelleRead>>;
  readonly game: ReturnType<typeof vi.fn<SpielRead>>;
  readonly clubTeams: ReturnType<typeof vi.fn<VereinsTeamsRead>>;
} {
  return {
    teamGames: vi.fn<TeamSpieleRead>(read),
    standings: vi.fn<TabelleRead>(standings),
    game: vi.fn<SpielRead>(details),
    clubTeams: vi.fn<VereinsTeamsRead>(clubTeams),
  };
}

function providers(
  data: ReturnType<typeof fakeData>,
  heute: WritableSignal<string> = signal(HEUTE_IM_SPEC)
) {
  return [
    provideRouter([]),
    { provide: BASKETBALL_DATA, useValue: data },
    { provide: HEUTE, useValue: heute },
    { provide: JETZT, useValue: signal(JETZT_IM_SPEC) },
    // in memory: nothing reaches the device's storage
    { provide: AUSWAHL, useFactory: () => new LocalSelection(undefined) },
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

function spielZeilen(page: HTMLElement): HTMLElement[] {
  return [...page.querySelectorAll<HTMLElement>('[data-qa="spiel"]')];
}

function feld(zeile: HTMLElement, name: string): string | undefined {
  return zeile
    .querySelector(`[data-qa="spiel-${name}"]`)
    ?.textContent?.replace(/\s+/g, ' ')
    .trim();
}

describe('TeamComponent', () => {
  describe('the last good data', () => {
    it("shows the Team's last good Spiele with their age where the read fell back on them", async () => {
      const page = await render(
        fakeData(async (_team, options?: KorbReadOptions) => {
          options?.lesung?.ersetzt({
            gespeichertAm: JETZT_IM_SPEC - ZWEI_STUNDEN,
            grund: 'kein-internet',
          });
          return saison([spiel({ id: 1, date: '2026-09-20' })]);
        })
      );

      expect(
        page.querySelector('[data-qa="team-stand"]')?.textContent
      ).toContain('Offline · Stand: vor 2 Std.');
      expect(spielZeilen(page)).toHaveLength(1);
      expect(page.querySelector('[role="alert"]')).toBeNull();
    });

    it("labels the Team's head with the oldest Stand of what it shows, the next Spiel's Halle too", async () => {
      const page = await render(
        fakeData(
          async () => saison([spiel({ id: 1, date: '2026-11-14' })]),
          keineZeilen,
          async (spielId, options?: KorbReadOptions) => {
            options?.lesung?.ersetzt({
              gespeichertAm: JETZT_IM_SPEC - ZWEI_STUNDEN,
              grund: 'unavailable',
            });
            return inDerSchulsporthalle(spielId);
          }
        )
      );

      expect(
        page.querySelector('[data-qa="team-stand"]')?.textContent
      ).toContain('DBB nicht erreichbar · Stand: vor 2 Std.');
    });

    it("labels the Verein's other Teams with their own Stand", async () => {
      const page = await render(
        fakeData(
          async () => saison([spiel({ id: 1, date: '2026-11-14' })]),
          keineZeilen,
          inDerSchulsporthalle,
          async (verein, options?: KorbReadOptions) => {
            options?.lesung?.ersetzt({
              gespeichertAm: JETZT_IM_SPEC - ZWEI_STUNDEN,
              grund: 'kein-internet',
            });
            return OHNE_TEAMS(verein);
          }
        )
      );

      expect(
        page.querySelector('[data-qa="vereins-stand"]')?.textContent
      ).toContain('Offline · Stand: vor 2 Std.');
      expect(
        page.querySelector('[data-qa="team-stand"] [data-qa="stand"]')
      ).toBeNull();
    });

    it('labels no Stand for Spiele just read', async () => {
      const page = await render(fakeData(async () => saison([])));

      expect(page.querySelector('[data-qa="stand"]')).toBeNull();
    });
  });

  it("reads the Team of the page's id", async () => {
    const data = fakeData(async () => saison([]));

    await render(data, '313036');

    expect(data.teamGames).toHaveBeenCalledWith(
      313036,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('names the Team', async () => {
    const page = await render(fakeData(async () => saison([])));

    expect(page.querySelector('h1')?.textContent).toContain('MTV Wasbüttel');
  });

  it("lists every Spiel of every Liga in the port's order, by date", async () => {
    // the port promises date order; the page shows what it gets as it is
    const page = await render(
      fakeData(async () =>
        saison([
          spiel({ id: 1, date: '2026-08-29', leagueId: TESTSPIELE.id }),
          spiel({ id: 2, date: '2026-09-20', time: '15:00' }),
          spiel({ id: 3, date: '2026-09-20', time: '09:00' }),
          spiel({ id: 4, date: '2026-09-12' }),
        ])
      )
    );

    expect(spielZeilen(page).map((zeile) => feld(zeile, 'datum'))).toEqual([
      'Sa., 29.08.2026',
      'So., 20.09.2026',
      'So., 20.09.2026',
      'Sa., 12.09.2026',
    ]);
    expect(spielZeilen(page).map((zeile) => feld(zeile, 'uhrzeit'))).toEqual([
      '10:00',
      '15:00',
      '09:00',
      '10:00',
    ]);
    expect(spielZeilen(page).map((zeile) => feld(zeile, 'liga'))).toEqual([
      TESTSPIELE.name,
      VORRUNDE.name,
      VORRUNDE.name,
      VORRUNDE.name,
    ]);
  });

  it('shows no time where the DBB has none', async () => {
    const page = await render(
      fakeData(async () =>
        saison([spiel({ id: 1, date: '2026-09-12', time: undefined })])
      )
    );

    expect(feld(spielZeilen(page)[0], 'uhrzeit')).toBeUndefined();
  });

  it('tells home from away and names the opponent', async () => {
    const page = await render(
      fakeData(async () =>
        saison([
          spiel({ id: 1, date: '2026-09-12', away: gegner(2, 'MTV Gifhorn') }),
          spiel({
            id: 2,
            date: '2026-09-20',
            home: gegner(3, 'SV Groß Oesingen'),
            away: UNS,
          }),
        ])
      )
    );

    const [heim, auswaerts] = spielZeilen(page);
    expect(feld(heim, 'ort')).toBe('Heim');
    expect(feld(heim, 'gegner')).toBe('MTV Gifhorn');
    expect(feld(auswaerts, 'ort')).toBe('Auswärts');
    expect(feld(auswaerts, 'gegner')).toBe('SV Groß Oesingen');
  });

  it('names both sides of a Spiel the DBB lists without the Team', async () => {
    const page = await render(
      fakeData(async () =>
        saison([
          spiel({
            id: 1,
            date: '2026-09-12',
            home: gegner(2, 'MTV Gifhorn'),
            away: gegner(3, 'SV Groß Oesingen'),
          }),
        ])
      )
    );

    expect(feld(spielZeilen(page)[0], 'ort')).toBeUndefined();
    expect(feld(spielZeilen(page)[0], 'gegner')).toBe(
      'MTV Gifhorn – SV Groß Oesingen'
    );
  });

  it('names an opponent the Liga has yet to settle by its slot', async () => {
    const page = await render(
      fakeData(async () =>
        saison([
          spiel({
            id: 1,
            date: '2026-12-05',
            away: { kind: 'open', label: 'Nord 1. Platz' },
          }),
        ])
      )
    );

    expect(feld(spielZeilen(page)[0], 'gegner')).toBe('Nord 1. Platz');
  });

  it('shows the result, home first, once played', async () => {
    const page = await render(
      fakeData(async () =>
        saison([
          spiel({
            id: 1,
            date: '2026-09-12',
            home: gegner(3, 'TuS Müden-Dieckhorst'),
            away: UNS,
            status: {
              kind: 'played',
              result: { home: 46, away: 99 },
              confirmed: true,
            },
          }),
          spiel({ id: 2, date: '2026-11-21' }),
        ])
      )
    );

    const [gespielt, geplant] = spielZeilen(page);
    expect(feld(gespielt, 'ergebnis')).toBe('46:99');
    expect(feld(geplant, 'ergebnis')).toBeUndefined();
  });

  it('marks a result the Verband has not confirmed yet as vorläufig', async () => {
    const page = await render(
      fakeData(async () =>
        saison([
          spiel({
            id: 1,
            date: '2026-09-12',
            status: {
              kind: 'played',
              result: { home: 99, away: 46 },
              confirmed: false,
            },
          }),
          spiel({
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

    const [vorlaeufig, bestaetigt] = spielZeilen(page);
    expect(feld(vorlaeufig, 'ausgang')).toBe('Sieg');
    expect(feld(vorlaeufig, 'vorlaeufig')).toBe('vorläufig');
    expect(feld(bestaetigt, 'vorlaeufig')).toBeUndefined();
  });

  it('shows a result the DBB never confirms (BBL, ProA, ProB) as final', async () => {
    const bbl: League = {
      ...liga(55802, '1. Bundesliga (easyCredit BBL)'),
      association: { id: 100, name: 'Bundesligen' },
      resultsNeverConfirmed: true,
    };
    const unbestaetigt = (id: number, ligaId: number): Game =>
      spiel({
        id,
        leagueId: ligaId,
        date: `2026-09-1${id}`,
        status: {
          kind: 'played',
          result: { home: 99, away: 46 },
          confirmed: false,
        },
      });
    const page = await render(
      fakeData(async () => ({
        ...saison([unbestaetigt(1, bbl.id), unbestaetigt(2, VORRUNDE.id)]),
        leagues: [bbl, VORRUNDE],
      }))
    );

    const [inDerBbl, inDerVorrunde] = spielZeilen(page);
    expect(feld(inDerBbl, 'ergebnis')).toBe('99:46');
    expect(feld(inDerBbl, 'ausgang')).toBe('Sieg');
    expect(feld(inDerBbl, 'vorlaeufig')).toBeUndefined();
    expect(feld(inDerVorrunde, 'vorlaeufig')).toBe('vorläufig');
  });

  it('says in words how each decided Spiel ended for the Team', async () => {
    const gespielt = (heim: number, gast: number) =>
      ({
        kind: 'played',
        result: { home: heim, away: gast },
        confirmed: true,
      }) as const;
    const page = await render(
      fakeData(async () =>
        saison([
          spiel({
            id: 1,
            date: '2026-09-12',
            home: gegner(3, 'TuS Müden-Dieckhorst'),
            away: UNS,
            status: gespielt(46, 99),
          }),
          spiel({ id: 2, date: '2026-09-19', status: gespielt(40, 52) }),
          spiel({
            id: 3,
            date: '2026-09-26',
            status: { kind: 'forfeited', forfeitedBy: ['home'] },
          }),
          spiel({ id: 4, date: '2026-11-21' }),
        ])
      )
    );

    expect(spielZeilen(page).map((zeile) => feld(zeile, 'ausgang'))).toEqual([
      'Sieg',
      'Niederlage',
      'Niederlage',
      undefined,
    ]);
  });

  it('marks a cancelled Spiel', async () => {
    const page = await render(
      fakeData(async () =>
        saison([
          spiel({ id: 1, date: '2026-10-03', status: { kind: 'cancelled' } }),
        ])
      )
    );

    expect(feld(spielZeilen(page)[0], 'markierung')).toBe('abgesagt');
    expect(feld(spielZeilen(page)[0], 'ergebnis')).toBeUndefined();
  });

  it('marks a forfeited Spiel, with its result where there is one', async () => {
    const page = await render(
      fakeData(async () =>
        saison([
          spiel({
            id: 1,
            date: '2026-10-03',
            status: {
              kind: 'forfeited',
              forfeitedBy: ['away'],
              result: { home: 20, away: 0 },
            },
          }),
          spiel({
            id: 2,
            date: '2026-10-10',
            status: { kind: 'forfeited', forfeitedBy: [] },
          }),
        ])
      )
    );

    const [mitErgebnis, ohneErgebnis] = spielZeilen(page);
    expect(feld(mitErgebnis, 'markierung')).toBe('kampflos');
    expect(feld(mitErgebnis, 'ergebnis')).toBe('20:0');
    expect(feld(ohneErgebnis, 'markierung')).toBe('kampflos');
    expect(feld(ohneErgebnis, 'ergebnis')).toBeUndefined();
  });

  it("opens each Spiel's page", async () => {
    const page = await render(
      fakeData(async () =>
        saison([
          spiel({ id: 2861436, date: '2026-09-20' }),
          spiel({ id: 2861439, date: '2026-09-25' }),
        ])
      )
    );

    expect(
      spielZeilen(page).map((zeile) => zeile.closest('a')?.getAttribute('href'))
    ).toEqual(['/spiel/2861436', '/spiel/2861439']);
  });

  describe('the next Spiel', () => {
    const MIT_NAECHSTEM = saison([
      spiel({
        id: 1,
        date: '2026-10-03',
        status: {
          kind: 'played',
          result: { home: 78, away: 47 },
          confirmed: true,
        },
      }),
      spiel({ id: 2, date: '2026-11-21', time: '11:00' }),
      spiel({ id: 3, date: '2026-11-28' }),
    ]);

    function naechstes(page: HTMLElement): HTMLElement | null {
      return page.querySelector('[data-qa="team-naechstes"]');
    }

    it('shows it with its Halle and a link that opens navigation', async () => {
      const page = await render(fakeData(async () => MIT_NAECHSTEM));

      const block = naechstes(page);
      expect(block?.textContent).toContain('Nächstes Spiel');
      expect(block?.textContent).toContain('Sa., 21.11.2026');
      expect(
        block?.querySelector('[data-qa="halle-name"]')?.textContent?.trim()
      ).toBe('Schulsporthalle');
      const navigation = block?.querySelector('[data-qa="halle-navigation"]');
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
      const data = fakeData(async () => MIT_NAECHSTEM);

      await render(data);

      expect(data.game.mock.calls.map(([spielId]) => spielId)).toEqual([2]);
    });

    it('shows none and reads no Halle once every Spiel is played', async () => {
      const data = fakeData(async () => saison([MIT_NAECHSTEM.games[0]]));

      const page = await render(data);

      expect(naechstes(page)).toBeNull();
      expect(data.game).not.toHaveBeenCalled();
    });

    it('keeps the Spiele when its Halle cannot be read', async () => {
      const page = await render(
        fakeData(
          async () => MIT_NAECHSTEM,
          keineZeilen,
          async () => {
            throw new BasketballDataError('unavailable', 'DBB: nope');
          }
        )
      );

      expect(
        naechstes(page)?.querySelector('[data-qa="halle-fehler"]')?.textContent
      ).toContain('Der DBB ist gerade nicht erreichbar.');
      expect(spielZeilen(page)).toHaveLength(3);
      expect(page.querySelectorAll('[role="alert"]')).toHaveLength(0);
    });
  });

  it('offers to follow the Team', async () => {
    const page = await render(fakeData(async () => saison([])));

    expect(
      page.querySelector('[data-qa="team-folgen"]')?.textContent
    ).toContain('Team folgen');
  });

  it('offers no Team to follow for an id the DBB does not know', async () => {
    const page = await render(
      fakeData(async () => {
        throw new BasketballDataError('not-found', 'DBB: nope');
      })
    );

    expect(page.querySelector('[data-qa="team-folgen"]')).toBeNull();
  });

  it('offers to unfollow a followed Team whose read fails', async () => {
    const auswahl = new LocalSelection(undefined);
    await auswahl.follow(313036);
    TestBed.configureTestingModule({
      providers: [
        ...providers(
          fakeData(async () => {
            throw new BasketballDataError('not-found', 'DBB: nope');
          })
        ),
        { provide: AUSWAHL, useValue: auswahl },
      ],
    });
    const fixture = TestBed.createComponent(TeamComponent);
    fixture.componentRef.setInput('teamId', '313036');
    await fixture.whenStable();
    const knopf = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-qa="team-folgen"]'
    ) as HTMLButtonElement | null;
    expect(knopf?.textContent).toContain('Nicht mehr folgen');

    knopf?.click();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();

    expect(auswahl.teams()).toEqual([]);
  });

  it('names the Team in the breadcrumb, below the overview', async () => {
    await render(fakeData(async () => saison([])));

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
    const page = await render(fakeData(async () => saison([])));

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
    expect(spielZeilen(page)).toEqual([]);
  });

  it.each(['313036abc', '-1', '0'])(
    'shows no Team for the id %s, without asking the DBB',
    async (teamId) => {
      const data = fakeData(async () => saison([]));

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
    const erster = data.teamGames.mock.calls[0][1]?.signal;

    fixture.componentRef.setInput('teamId', '201500');
    fixture.detectChanges();

    expect(data.teamGames).toHaveBeenLastCalledWith(
      201500,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(erster?.aborted).toBe(true);
  });
  describe('Tabellen', () => {
    const ZWEI_LIGEN = saison([
      spiel({ id: 1, date: '2026-08-29', leagueId: TESTSPIELE.id }),
      spiel({ id: 2, date: '2026-09-12' }),
      spiel({ id: 3, date: '2026-11-08' }),
    ]);

    function tabellen(page: HTMLElement): HTMLElement[] {
      return [...page.querySelectorAll<HTMLElement>('[data-qa="tabelle"]')];
    }

    function ueberschrift(tabelle: HTMLElement): string | undefined {
      return tabelle.querySelector('h3')?.textContent?.trim();
    }

    const VORRUNDE_TABELLE: Standings = {
      league: VORRUNDE,
      rows: [
        tabellenZeile(1, { id: 201500, name: 'MTV Gifhorn', clubId: 201500 }),
        tabellenZeile(2, UNSER_TEAM),
      ],
    };

    it('shows one Tabelle per Liga of its Spiele, the current Liga first', async () => {
      const data = fakeData(async () => ZWEI_LIGEN);

      const page = await render(data);

      expect(tabellen(page).map(ueberschrift)).toEqual([
        VORRUNDE.name,
        TESTSPIELE.name,
      ]);
      expect(data.standings.mock.calls.map(([ligaId]) => ligaId)).toEqual([
        VORRUNDE.id,
        TESTSPIELE.id,
      ]);
    });

    it('puts the next Liga first once the day of the last Spiel of the current one has passed', async () => {
      const heute = signal('2026-11-08');
      TestBed.configureTestingModule({
        providers: providers(
          fakeData(async () =>
            saison([
              spiel({ id: 1, date: '2026-08-29', leagueId: TESTSPIELE.id }),
              spiel({ id: 2, date: '2026-11-08' }),
              spiel({ id: 3, date: '2026-11-21', leagueId: TESTSPIELE.id }),
            ])
          ),
          heute
        ),
      });
      const fixture = TestBed.createComponent(TeamComponent);
      fixture.componentRef.setInput('teamId', '313036');
      await fixture.whenStable();
      const page = fixture.nativeElement as HTMLElement;
      expect(tabellen(page).map(ueberschrift)).toEqual([
        VORRUNDE.name,
        TESTSPIELE.name,
      ]);

      heute.set('2026-11-09');
      await fixture.whenStable();

      expect(tabellen(page).map(ueberschrift)).toEqual([
        TESTSPIELE.name,
        VORRUNDE.name,
      ]);
    });

    it('highlights the Team in its Tabelle', async () => {
      const page = await render(
        fakeData(
          async () => ZWEI_LIGEN,
          async (ligaId) =>
            ligaId === VORRUNDE.id
              ? VORRUNDE_TABELLE
              : { league: TESTSPIELE, rows: [] }
        )
      );

      const eigene = page.querySelector('[aria-current="true"]');
      expect(eigene?.textContent).toContain('MTV Wasbüttel');
      expect(eigene?.textContent).toContain('(dein Team)');
    });

    it('keeps the Spiele and the other Tabelle when one Tabelle fails', async () => {
      const page = await render(
        fakeData(
          async () => ZWEI_LIGEN,
          async (ligaId) => {
            if (ligaId === TESTSPIELE.id) {
              throw new BasketballDataError('unavailable', 'DBB: nope');
            }
            return VORRUNDE_TABELLE;
          }
        )
      );

      expect(spielZeilen(page)).toHaveLength(3);
      const [vorrunde, testspiele] = tabellen(page);
      expect(
        vorrunde.querySelectorAll('[data-qa="tabelle-zeile"]')
      ).toHaveLength(2);
      expect(
        testspiele.querySelector('[data-qa="tabelle-fehler"]')?.textContent
      ).toContain('Der DBB ist gerade nicht erreichbar.');
    });

    it('raises no alert per Tabelle when the DBB fails them all', async () => {
      const page = await render(
        fakeData(
          async () => ZWEI_LIGEN,
          async () => {
            throw new BasketballDataError('unavailable', 'DBB: nope');
          }
        )
      );

      expect(page.querySelectorAll('[data-qa="tabelle-fehler"]')).toHaveLength(
        2
      );
      expect(page.querySelectorAll('[role="alert"]')).toHaveLength(0);
    });

    it('shows no Tabelle for a Team without Spiele', async () => {
      const data = fakeData(async () => saison([]));

      const page = await render(data);

      expect(tabellen(page)).toEqual([]);
      expect(data.standings).not.toHaveBeenCalled();
    });
  });

  describe('weitere Teams des Vereins', () => {
    const MIT_VEREIN = (spiele: readonly Game[]) =>
      fakeData(
        async () => saison(spiele),
        keineZeilen,
        inDerSchulsporthalle,
        async () => UNSER_VEREIN
      );

    function feldIn(zeile: HTMLElement, qa: string): string | undefined {
      return zeile.querySelector(`[data-qa="${qa}"]`)?.textContent?.trim();
    }

    function clubTeams(page: HTMLElement): HTMLElement[] {
      return [
        ...page.querySelectorAll<HTMLElement>('[data-qa="vereins-team"]'),
      ];
    }

    it("reads the Teams of the Team's Verein", async () => {
      const data = MIT_VEREIN([]);

      await render(data);

      expect(data.clubTeams).toHaveBeenCalledWith(
        1837,
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('lists the other Teams with their Ligen, each linking to its page, the Team itself left out', async () => {
      const page = await render(MIT_VEREIN([]));

      expect(
        clubTeams(page).map((zeile) => [
          feldIn(zeile, 'vereins-team-name'),
          feldIn(zeile, 'vereins-team-ligen'),
        ])
      ).toEqual([
        ['MTV Wasbüttel 2', 'Regionsvorrunde Nordwest mu14'],
        ['MTV Wasbüttel', 'Regionsliga Braunschweig mu16'],
      ]);
      expect(
        clubTeams(page).map((zeile) =>
          zeile.querySelector('a')?.getAttribute('href')
        )
      ).toEqual(['/team/317618', '/team/270037']);
    });

    it('follows another Team of the Verein from its line', async () => {
      const auswahl = new LocalSelection(undefined);
      TestBed.configureTestingModule({
        providers: [
          ...providers(MIT_VEREIN([])),
          { provide: AUSWAHL, useValue: auswahl },
        ],
      });
      const fixture = TestBed.createComponent(TeamComponent);
      fixture.componentRef.setInput('teamId', '313036');
      await fixture.whenStable();
      const page = fixture.nativeElement as HTMLElement;

      const knopf = clubTeams(page)[0].querySelector('button');
      expect(knopf?.getAttribute('aria-label')).toBe(
        'Team folgen: MTV Wasbüttel 2'
      );
      knopf?.click();
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();

      expect(auswahl.teams()).toEqual([317618]);
      expect(knopf?.getAttribute('aria-label')).toBe(
        'Nicht mehr folgen: MTV Wasbüttel 2'
      );
    });

    it('reads the Verein once when switching to a sibling Team of it', async () => {
      const geschwister: Team = {
        id: 317618,
        name: 'MTV Wasbüttel 2',
        clubId: 1837,
      };
      const data = fakeData(
        async (teamId) => ({
          ...saison([]),
          team: teamId === geschwister.id ? geschwister : UNSER_TEAM,
        }),
        keineZeilen,
        inDerSchulsporthalle,
        async () => UNSER_VEREIN
      );
      TestBed.configureTestingModule({ providers: providers(data) });
      const fixture = TestBed.createComponent(TeamComponent);
      fixture.componentRef.setInput('teamId', '313036');
      await fixture.whenStable();

      fixture.componentRef.setInput('teamId', String(geschwister.id));
      await fixture.whenStable();

      const page = fixture.nativeElement as HTMLElement;
      expect(page.querySelector('h1')?.textContent).toContain(
        'MTV Wasbüttel 2'
      );
      expect(data.clubTeams).toHaveBeenCalledTimes(1);
      expect(
        clubTeams(page).map((zeile) =>
          zeile.querySelector('a')?.getAttribute('href')
        )
      ).toEqual(['/team/313036', '/team/270037']);
    });

    it('says so where the Verein shows no other Team', async () => {
      const page = await render(fakeData(async () => saison([])));

      expect(clubTeams(page)).toEqual([]);
      expect(
        page.querySelector('[data-qa="vereins-teams"]')?.textContent
      ).toContain('Keine weiteren Teams');
    });

    it('keeps the Spiele when the Verein cannot be read', async () => {
      const page = await render(
        fakeData(
          async () => saison([spiel({ id: 1, date: '2026-11-21' })]),
          keineZeilen,
          inDerSchulsporthalle,
          async () => {
            throw new BasketballDataError('unavailable', 'DBB: nope');
          }
        )
      );

      expect(spielZeilen(page)).toHaveLength(1);
      expect(
        page.querySelector('[data-qa="vereins-teams-fehler"]')?.textContent
      ).toContain('Der DBB ist gerade nicht erreichbar.');
      expect(page.querySelectorAll('[role="alert"]')).toHaveLength(0);
    });
  });

  describe('the end of the Saison', () => {
    const GESPIELT: Game['status'] = {
      kind: 'played',
      result: { home: 78, away: 47 },
      confirmed: true,
    };

    function mitLetztemSpielAm(datum: string) {
      return fakeData(
        async () => saison([spiel({ id: 1, date: datum, status: GESPIELT })]),
        keineZeilen,
        inDerSchulsporthalle,
        async () => UNSER_VEREIN
      );
    }

    function hinweis(page: HTMLElement): HTMLElement | null {
      return page.querySelector('[data-qa="saison-beendet"]');
    }

    it("asks whether the Saison is over and suggests the Verein's current Teams", async () => {
      // more than two weeks before 8 November
      const page = await render(mitLetztemSpielAm('2026-10-24'));

      expect(hinweis(page)?.textContent).toContain(
        'Keine Spiele mehr angesetzt. Ist die Saison vorbei?'
      );
      expect(hinweis(page)?.textContent).not.toContain('Saison ist vorbei');
      expect(
        [
          ...(hinweis(page)?.querySelectorAll(
            '[data-qa="vereins-team-name"]'
          ) ?? []),
        ].map((name) => name.textContent?.trim())
      ).toEqual(['MTV Wasbüttel 2', 'MTV Wasbüttel']);
      expect(page.querySelectorAll('[data-qa="vereins-teams"]')).toHaveLength(
        1
      );
    });

    it('says nothing exactly two weeks after the last Spiel', async () => {
      const page = await render(mitLetztemSpielAm('2026-10-25'));

      expect(hinweis(page)).toBeNull();
      expect(page.querySelector('[data-qa="vereins-teams"]')).not.toBeNull();
    });

    it('says nothing while a Spiel is still to come', async () => {
      const page = await render(
        fakeData(async () =>
          saison([
            spiel({ id: 1, date: '2026-09-20', status: GESPIELT }),
            spiel({ id: 2, date: '2026-12-05' }),
          ])
        )
      );

      expect(hinweis(page)).toBeNull();
    });
  });
});
