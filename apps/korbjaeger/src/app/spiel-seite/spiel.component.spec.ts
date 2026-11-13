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
import { AUSWAHL } from '../auswahl/auswahl';
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
import { SpielComponent } from './spiel.component';
import { Breadcrumb } from '../navigation/breadcrumb';

/** Noon on the day of the Spiel, in Germany. */
const JETZT_IM_SPEC = Date.parse('2026-11-08T12:00:00+01:00');

const HALLE: Venue = {
  name: 'Schulsporthalle',
  street: 'Schulstr. 12',
  postcode: '38553',
  town: 'Wasbüttel',
};

const GESPIELT: GameDetails = {
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
  venue: HALLE,
  quarters: [
    { home: 20, away: 10 },
    { home: 18, away: 12 },
    { home: 22, away: 9 },
    { home: 18, away: 16 },
  ],
  overtimes: [],
};

function werte(punkte: number, fouls = 2): PlayerStats {
  return playerStatsOf({
    points: punkte,
    twoPointers: { made: 4, attempted: 0 },
    threePointers: { made: 1, attempted: 0 },
    freeThrows: { made: 3, attempted: 5 },
    fouls,
  });
}

/** A starter of the 1. Regionalliga, every value recorded. */
const ALLE_WERTE = playerStatsOf({
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

const MIT_WERTEN: Roster = {
  playerStatsRecorded: true,
  entries: [
    {
      kind: 'named',
      personId: 91692638,
      firstName: 'Ilvio',
      lastName: 'Mistelgrund',
      shirtNumber: '7',
      playerStats: werte(14),
    },
    { kind: 'anonymous', playerStats: werte(10, 4) },
  ],
};

const OHNE_WERTE: Roster = {
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

function bericht(heim: Roster, gast: Roster): GameReport {
  return { gameId: 2861436, home: heim, away: gast };
}

type SpielRead = KorbjaegerData['game'];
type BerichtRead = KorbjaegerData['gameReport'];

function fakeData(
  game: SpielRead,
  gameReport: BerichtRead
): {
  readonly game: ReturnType<typeof vi.fn<SpielRead>>;
  readonly gameReport: ReturnType<typeof vi.fn<BerichtRead>>;
} {
  return {
    game: vi.fn<SpielRead>(game),
    gameReport: vi.fn<BerichtRead>(gameReport),
  };
}

const NIE = new Promise<never>(() => undefined);

async function render(
  data: ReturnType<typeof fakeData>,
  spielId = '2861436'
): Promise<HTMLElement> {
  return (await renderMit(data, new LocalSelection(undefined), spielId)).seite;
}

/** Renders the page of `spielId` on `data` with `auswahl`. */
async function renderMit(
  data: ReturnType<typeof fakeData>,
  auswahl: Selection,
  spielId = '2861436'
): Promise<{
  readonly seite: HTMLElement;
  /** Waits for the reads that settle, the dialogs and the page. */
  readonly stabil: () => Promise<void>;
}> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: BASKETBALL_DATA, useValue: data },
      { provide: NOW, useValue: signal(JETZT_IM_SPEC) },
      { provide: AUSWAHL, useValue: auswahl },
      // the dialogs close at once, without waiting for an animation
      { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
    ],
  });
  const fixture = TestBed.createComponent(SpielComponent);
  fixture.componentRef.setInput('spielId', spielId);
  // not whenStable: it waits for every read, and some never settle here
  const stabil = async (): Promise<void> => {
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  };
  await stabil();
  return { seite: fixture.nativeElement as HTMLElement, stabil };
}

function text(element: Element | null | undefined): string | undefined {
  return element?.textContent?.replace(/\s+/g, ' ').trim();
}

function teil(seite: ParentNode, name: string): HTMLElement | null {
  return seite.querySelector<HTMLElement>(`[data-qa="${name}"]`);
}

function alle(seite: ParentNode, name: string): HTMLElement[] {
  return [...seite.querySelectorAll<HTMLElement>(`[data-qa="${name}"]`)];
}

/** The cells of each line of a table, as text. */
function zellen(tabelle: HTMLElement | null, zeile: string): string[][] {
  return alle(tabelle ?? document, zeile).map((tr) =>
    [...tr.querySelectorAll('td')].map((td) => text(td) ?? '')
  );
}

function kopfzellen(tabelle: HTMLElement | null): string[] {
  return [...(tabelle?.querySelectorAll('th') ?? [])].map(
    (th) => th.getAttribute('aria-label') ?? text(th) ?? ''
  );
}

describe('SpielComponent', () => {
  describe('the last good data', () => {
    const VOR_EINER_STUNDE: AsOf = {
      storedAt: JETZT_IM_SPEC - 60 * 60_000,
      reason: 'unavailable',
    };

    it('labels the Spiel with the age of its last good data', async () => {
      const page = await render(
        fakeData(
          async (_spiel, options?: KorbReadOptions) => {
            options?.reading?.replaced(VOR_EINER_STUNDE);
            return GESPIELT;
          },
          async () => bericht(MIT_WERTEN, OHNE_WERTE)
        )
      );

      expect(text(teil(page, 'spiel-stand'))).toContain(
        'DBB nicht erreichbar · Stand: vor 1 Std.'
      );
      // a Spielbericht names children: it is never kept, so never stale
      expect(teil(page, 'spielbericht-stand')).toBeNull();
    });

    it('labels neither while both were just read', async () => {
      const page = await render(
        fakeData(
          async () => GESPIELT,
          async () => bericht(MIT_WERTEN, OHNE_WERTE)
        )
      );

      expect(page.querySelector('[data-qa="as-of"]')).toBeNull();
    });
  });

  describe('the breadcrumb', () => {
    async function levelsWith(teams: readonly number[]) {
      const auswahl = new LocalSelection(undefined);
      for (const team of teams) {
        await auswahl.follow(team);
      }
      await renderMit(
        fakeData(
          async () => GESPIELT,
          async () => undefined
        ),
        auswahl
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
      async () => GESPIELT,
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
      (spielId) => (spielId === 2861436 ? Promise.resolve(GESPIELT) : NIE),
      (spielId) =>
        spielId === 2861436
          ? Promise.resolve(bericht(MIT_WERTEN, OHNE_WERTE))
          : NIE
    );
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: BASKETBALL_DATA, useValue: data },
      ],
    });
    const fixture = TestBed.createComponent(SpielComponent);
    const stabil = async (): Promise<void> => {
      fixture.detectChanges();
      await new Promise((resolve) => setTimeout(resolve));
      fixture.detectChanges();
    };
    fixture.componentRef.setInput('spielId', '2861436');
    await stabil();
    const seite = fixture.nativeElement as HTMLElement;
    expect(text(teil(seite, 'spiel-ergebnis'))).toBe('78:47');
    expect(alle(seite, 'kader')).toHaveLength(2);

    fixture.componentRef.setInput('spielId', '2911141');
    await stabil();

    expect(data.game).toHaveBeenLastCalledWith(
      2911141,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(data.gameReport).toHaveBeenLastCalledWith(
      2911141,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(teil(seite, 'spiel-ergebnis')).toBeNull();
    expect(teil(seite, 'venue')).toBeNull();
    expect(alle(seite, 'kader')).toEqual([]);
    expect(text(seite.querySelector('h1'))).toBe('Spiel');
  });

  describe('the Spiel', () => {
    it('shows the final score, day, time and Liga', async () => {
      const seite = await render(
        fakeData(
          async () => GESPIELT,
          async () => undefined
        )
      );

      expect(text(teil(seite, 'spiel-ergebnis'))).toBe('78:47');
      expect(text(teil(seite, 'spiel-wann'))).toBe(
        'So., 20.09.2026 · 09:00 Uhr'
      );
      expect(text(teil(seite, 'spiel-liga'))).toBe(
        'Regionsvorrunde Nord Braunschweig mu12'
      );
    });

    it('links both Teams to their Team pages', async () => {
      const seite = await render(
        fakeData(
          async () => GESPIELT,
          async () => undefined
        )
      );

      const heading = seite.querySelector('h1');
      expect(text(heading)).toBe('MTV Wasbüttel – MTV Gifhorn');
      expect(
        [...(heading?.querySelectorAll('a') ?? [])].map((a) =>
          a.getAttribute('href')
        )
      ).toEqual(['/team/313036', '/team/201500']);
    });

    it('names a side the Liga has yet to settle without a link', async () => {
      const seite = await render(
        fakeData(
          async () => ({
            ...GESPIELT,
            game: {
              ...GESPIELT.game,
              away: { kind: 'open', label: 'Nord 1. Platz' },
              status: { kind: 'scheduled' },
            },
          }),
          async () => undefined
        )
      );

      const heading = seite.querySelector('h1');
      expect(text(heading)).toBe('MTV Wasbüttel – Nord 1. Platz');
      expect(heading?.querySelectorAll('a')).toHaveLength(1);
    });

    it('shows the quarter scores with the final score', async () => {
      const seite = await render(
        fakeData(
          async () => GESPIELT,
          async () => undefined
        )
      );

      const viertel = teil(seite, 'viertel');
      expect(kopfzellen(viertel)).toEqual([
        'Team',
        '1. Viertel',
        '2. Viertel',
        '3. Viertel',
        '4. Viertel',
        'Endstand',
      ]);
      expect(zellen(viertel, 'viertel-zeile')).toEqual([
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
        const seite = await render(
          fakeData(
            async () => ({
              ...GESPIELT,
              game: { ...GESPIELT.game, status },
            }),
            async () => undefined
          )
        );

        const viertel = teil(seite, 'viertel');
        expect(kopfzellen(viertel)).toEqual([
          'Team',
          '1. Viertel',
          '2. Viertel',
          '3. Viertel',
          '4. Viertel',
          'Endstand',
        ]);
        expect(zellen(viertel, 'viertel-zeile')).toEqual([
          ['MTV Wasbüttel', '20', '18', '22', '18', '–'],
          ['MTV Gifhorn', '10', '12', '9', '16', '–'],
        ]);
        // the quarters' sums, 78 and 47, are no final score
        expect(text(viertel)).not.toMatch(/\b(78|47)\b/);
      }
    );

    it('adds each overtime after the quarters', async () => {
      const seite = await render(
        fakeData(
          async () => ({
            ...GESPIELT,
            overtimes: [{ home: 6, away: 4 }],
          }),
          async () => undefined
        )
      );

      const viertel = teil(seite, 'viertel');
      expect(kopfzellen(viertel)).toContain('1. Verlängerung');
      expect(
        [...(viertel?.querySelectorAll('th') ?? [])].map((th) => text(th))
      ).toEqual(['Team', '1.', '2.', '3.', '4.', 'V1', 'Endstand']);
      expect(zellen(viertel, 'viertel-zeile')[0]).toEqual([
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
      const seite = await render(
        fakeData(
          async () => ({ ...GESPIELT, quarters: [] }),
          async () => undefined
        )
      );

      expect(teil(seite, 'viertel')).toBeNull();
      expect(text(teil(seite, 'spiel-ergebnis'))).toBe('78:47');
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
    ] as const)('shows %s', async (_case, status, anzeige) => {
      const seite = await render(
        fakeData(
          async () => ({
            ...GESPIELT,
            game: { ...GESPIELT.game, status },
            quarters: [],
          }),
          async () => undefined
        )
      );

      expect(text(teil(seite, 'spiel-status'))).toBe(anzeige);
    });

    it('shows no status line and no vorläufig for a confirmed result', async () => {
      const seite = await render(
        fakeData(
          async () => GESPIELT,
          async () => undefined
        )
      );

      expect(teil(seite, 'spiel-status')).toBeNull();
      expect(teil(seite, 'spiel-vorlaeufig')).toBeNull();
    });

    it('marks a result not confirmed yet as vorläufig beside the score', async () => {
      const seite = await render(
        fakeData(
          async () => ({
            ...GESPIELT,
            game: {
              ...GESPIELT.game,
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

      expect(text(teil(seite, 'spiel-ergebnis'))).toBe('78:47');
      expect(text(teil(seite, 'spiel-vorlaeufig'))).toBe('vorläufig');
      expect(
        seite
          .querySelector('.ergebnis')
          ?.textContent?.replace(/\s+/g, ' ')
          .trim()
      ).toBe('78:47 vorläufig');
      expect(text(teil(seite, 'spiel-status'))).toBe(
        'Ergebnis noch nicht bestätigt'
      );
    });

    it('shows a result the DBB never confirms (BBL, ProA, ProB) as final', async () => {
      const seite = await render(
        fakeData(
          async () => ({
            ...GESPIELT,
            game: {
              ...GESPIELT.game,
              status: {
                kind: 'played',
                result: { home: 78, away: 47 },
                confirmed: false,
              },
            },
            league: {
              ...GESPIELT.league,
              name: '1. Bundesliga (easyCredit BBL)',
              association: { id: 100, name: 'Bundesligen' },
              withoutGameReports: true,
              resultsNeverConfirmed: true,
            },
          }),
          async () => undefined
        )
      );

      expect(text(teil(seite, 'spiel-ergebnis'))).toBe('78:47');
      expect(teil(seite, 'spiel-vorlaeufig')).toBeNull();
      expect(teil(seite, 'spiel-status')).toBeNull();
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
      const seite = await render(
        fakeData(
          async () => ({ ...GESPIELT, game: { ...GESPIELT.game, status } }),
          async () => undefined
        )
      );

      expect(teil(seite, 'spiel-vorlaeufig')).toBeNull();
    });
  });

  describe('the Halle', () => {
    it('shows its name and address with a link that opens navigation', async () => {
      const seite = await render(
        fakeData(
          async () => GESPIELT,
          async () => undefined
        )
      );

      const halle = teil(seite, 'venue');
      expect(text(teil(halle ?? seite, 'venue-name'))).toBe('Schulsporthalle');
      expect(text(teil(halle ?? seite, 'venue-address'))).toBe(
        'Schulstr. 12, 38553 Wasbüttel'
      );
      const link = halle?.querySelector('a');
      expect(link?.getAttribute('href')).toBe(
        'https://www.google.com/maps/search/?api=1&query=Schulsporthalle%2C%20Schulstr.%2012%2C%2038553%20Wasb%C3%BCttel'
      );
      expect(link?.getAttribute('target')).toBe('_blank');
      expect(link?.getAttribute('rel')).toBe('noopener');
    });

    it('says so where the DBB names no Halle yet', async () => {
      const { venue: _keine, ...ohneHalle } = GESPIELT;
      const seite = await render(
        fakeData(
          async () => ohneHalle,
          async () => undefined
        )
      );

      expect(text(teil(seite, 'venue'))).toBe(
        'Die Halle steht noch nicht fest.'
      );
      expect(teil(seite, 'venue')?.querySelector('a')).toBeNull();
    });
  });

  describe('the Kader', () => {
    function kader(seite: HTMLElement): HTMLElement[] {
      return alle(seite, 'kader');
    }

    it('lists both Kader under their Teams', async () => {
      const seite = await render(
        fakeData(
          async () => GESPIELT,
          async () => bericht(MIT_WERTEN, OHNE_WERTE)
        )
      );

      expect(kader(seite).map((k) => text(k.querySelector('h3')))).toEqual([
        'MTV Wasbüttel',
        'MTV Gifhorn',
      ]);
    });

    it('shows the Spielerwerte of a Kader the Verband records them for', async () => {
      const seite = await render(
        fakeData(
          async () => GESPIELT,
          async () => bericht(MIT_WERTEN, MIT_WERTEN)
        )
      );

      const [heim] = kader(seite);
      expect(kopfzellen(heim)).toEqual([
        'Trikotnummer',
        'Name',
        'Punkte',
        'Feldkörbe',
        'Dreier',
        'Freiwürfe getroffen von versucht',
        'Fouls',
      ]);
      expect(zellen(heim, 'kader-zeile')).toEqual([
        ['7', 'Ilvio Mistelgrund', '14', '5', '1', '3/5', '2'],
        ['', 'Anonymer Spieler', '10', '5', '1', '3/5', '4'],
      ]);
      expect(teil(heim, 'kader-ohne-werte')).toBeNull();
      expect(teil(heim, 'kader-start')).toBeNull();
    });

    it('shows every Spielerwert the Verband records, and the starting five', async () => {
      const alleWerte: Roster = {
        playerStatsRecorded: true,
        entries: [
          {
            kind: 'named',
            personId: 96606327,
            firstName: 'Rilla',
            lastName: 'Schlehenau',
            shirtNumber: '1',
            playerStats: ALLE_WERTE,
          },
          {
            kind: 'anonymous',
            playerStats: { ...ALLE_WERTE, startingFive: false },
          },
        ],
      };
      const seite = await render(
        fakeData(
          async () => GESPIELT,
          async () => bericht(alleWerte, OHNE_WERTE)
        )
      );

      const [heim] = kader(seite);
      expect(kopfzellen(heim)).toEqual([
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
      const [starter, anonym] = zellen(heim, 'kader-zeile');
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
      expect(alle(heim, 'kader-start')).toHaveLength(1);
      expect(text(teil(heim, 'kader-start'))).toContain('In der Startfünf');
      expect(anonym[1]).toBe('Anonymer Spieler');
    });

    it('says "keine Spielerwerte erfasst" for a Kader without, never zeros', async () => {
      const seite = await render(
        fakeData(
          async () => GESPIELT,
          async () => bericht(MIT_WERTEN, OHNE_WERTE)
        )
      );

      const [heim, gast] = kader(seite);
      expect(text(teil(gast, 'kader-ohne-werte'))).toContain(
        'keine Spielerwerte erfasst'
      );
      expect(kopfzellen(gast)).toEqual(['Trikotnummer', 'Name']);
      expect(zellen(gast, 'kader-zeile')).toEqual([
        ['30', 'Delon Nesselbach'],
        ['', 'Anonymer Spieler'],
      ]);
      expect(teil(heim, 'kader-ohne-werte')).toBeNull();
    });

    it('leaves out the shirt numbers where the Kader lists none', async () => {
      const ohneNummern: Roster = {
        playerStatsRecorded: true,
        entries: [{ kind: 'anonymous', playerStats: werte(10) }],
      };
      const seite = await render(
        fakeData(
          async () => GESPIELT,
          async () => bericht(ohneNummern, OHNE_WERTE)
        )
      );

      const [heim, gast] = kader(seite);
      expect(kopfzellen(heim)[0]).toBe('Name');
      expect(zellen(heim, 'kader-zeile')).toEqual([
        ['Anonymer Spieler', '10', '5', '1', '3/5', '2'],
      ]);
      expect(kopfzellen(gast)[0]).toBe('Trikotnummer');
    });

    it('says "noch kein Spielbericht" while there is none', async () => {
      const seite = await render(
        fakeData(
          async () => GESPIELT,
          async () => undefined
        )
      );

      expect(kader(seite)).toEqual([]);
      expect(text(teil(seite, 'spielbericht-fehlt'))).toBe(
        'Noch kein Spielbericht. Schau später noch einmal vorbei.'
      );
    });

    it('says a cancelled Spiel has no Spielbericht to wait for', async () => {
      const seite = await render(
        fakeData(
          async () => ({
            ...GESPIELT,
            game: { ...GESPIELT.game, status: { kind: 'cancelled' } },
          }),
          async () => undefined
        )
      );

      expect(text(teil(seite, 'spielbericht-fehlt'))).toBe(
        'Das Spiel fällt aus, einen Spielbericht gibt es nicht.'
      );
    });

    describe('in a Liga the DBB keeps no Spielberichte for', () => {
      const OHNE_BERICHTE: GameDetails = {
        ...GESPIELT,
        league: { ...GESPIELT.league, withoutGameReports: true },
      };

      it('says so instead of asking to come back later', async () => {
        const seite = await render(
          fakeData(
            async () => OHNE_BERICHTE,
            async () => undefined
          )
        );

        expect(text(teil(seite, 'spielbericht-fehlt'))).toBe(
          'Für diese Liga führt der DBB keine Spielberichte, Kader und Viertel gibt es hier nicht.'
        );
      });

      it('still says a cancelled Spiel has no Spielbericht', async () => {
        const seite = await render(
          fakeData(
            async () => ({
              ...OHNE_BERICHTE,
              game: { ...OHNE_BERICHTE.game, status: { kind: 'cancelled' } },
            }),
            async () => undefined
          )
        );

        expect(text(teil(seite, 'spielbericht-fehlt'))).toBe(
          'Das Spiel fällt aus, einen Spielbericht gibt es nicht.'
        );
      });

      it('shows a Spielbericht that comes all the same', async () => {
        const seite = await render(
          fakeData(
            async () => OHNE_BERICHTE,
            async () => bericht(MIT_WERTEN, OHNE_WERTE)
          )
        );

        expect(kader(seite)).toHaveLength(2);
        expect(teil(seite, 'spielbericht-fehlt')).toBeNull();
      });
    });

    it('shows an Anonymer Spieler as anonymous: no link, no number, no id', async () => {
      const seite = await render(
        fakeData(
          async () => GESPIELT,
          async () => bericht(OHNE_WERTE, OHNE_WERTE)
        )
      );

      const [heim] = kader(seite);
      const anonym = alle(heim, 'kader-zeile')[1];
      expect(text(anonym)).toBe('Anonymer Spieler');
      expect(anonym.querySelector('a')).toBeNull();
      expect(heim.querySelectorAll('a')).toHaveLength(0);
      expect(heim.innerHTML).not.toContain('92256481');
    });

    it('names the Kader Heim and Gast while the Spiel cannot be read', async () => {
      const seite = await render(
        fakeData(
          async () => {
            throw new BasketballDataError('unavailable', 'DBB: nope');
          },
          async () => bericht(OHNE_WERTE, OHNE_WERTE)
        )
      );

      expect(kader(seite).map((k) => text(k.querySelector('h3')))).toEqual([
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

    async function mitAuswahl(
      teams: readonly number[],
      kinder: readonly Child[] = [],
      gameReport: GameReport = bericht(MIT_WERTEN, OHNE_WERTE)
    ): Promise<{
      readonly seite: HTMLElement;
      readonly auswahl: LocalSelection;
      readonly stabil: () => Promise<void>;
    }> {
      const auswahl = new LocalSelection(undefined);
      for (const team of teams) {
        await auswahl.follow(team);
      }
      for (const { personId, nickname: spitzname } of kinder) {
        await auswahl.mark({ kind: 'named', personId }, spitzname);
      }
      const gerendert = await renderMit(
        fakeData(
          async () => GESPIELT,
          async () => gameReport
        ),
        auswahl
      );
      return { ...gerendert, auswahl };
    }

    afterEach(() => {
      // a dialog left open lives outside the page
      document.querySelector('.cdk-overlay-container')?.replaceChildren();
    });

    function kaderVon(seite: HTMLElement, team: string): HTMLElement {
      const gefunden = alle(seite, 'kader').find(
        (kader) => text(kader.querySelector('h3')) === team
      );
      if (gefunden === undefined) {
        throw new Error(`no Kader of ${team}`);
      }
      return gefunden;
    }

    function zeileVon(kader: HTMLElement, name: string): HTMLElement {
      const zeile = alle(kader, 'kader-zeile').find((tr) =>
        text(tr.querySelector('.name'))?.includes(name)
      );
      if (zeile === undefined) {
        throw new Error(`no line of ${name}`);
      }
      return zeile;
    }

    function markierKnoepfe(kader: HTMLElement): HTMLButtonElement[] {
      return [
        ...kader.querySelectorAll<HTMLButtonElement>(
          'button[aria-label="Als mein Kind markieren"]'
        ),
      ];
    }

    function dialog(): HTMLElement | null {
      return document.querySelector<HTMLElement>('korb-spitzname-dialog');
    }

    function knopf(
      wo: ParentNode | null,
      beschriftung: string
    ): HTMLButtonElement {
      const gefunden = [
        ...(wo ?? document).querySelectorAll<HTMLButtonElement>('button'),
      ].find((button) => text(button)?.includes(beschriftung));
      if (gefunden === undefined) {
        throw new Error(`no button ${beschriftung}`);
      }
      return gefunden;
    }

    async function spitznameEingeben(
      spitzname: string,
      stabil: () => Promise<void>
    ): Promise<void> {
      const eingabe = dialog()?.querySelector('input');
      if (!eingabe) {
        throw new Error('no dialog open');
      }
      eingabe.value = spitzname;
      eingabe.dispatchEvent(new Event('input'));
      eingabe.form?.requestSubmit();
      await stabil();
    }

    it("offers to mark each named player of a followed Team's Kader, no Anonymer Spieler", async () => {
      const { seite } = await mitAuswahl([WASBUETTEL]);

      const heim = kaderVon(seite, 'MTV Wasbüttel');
      expect(markierKnoepfe(heim)).toHaveLength(1);
      expect(
        zeileVon(heim, 'Anonymer Spieler').querySelector('button')
      ).toBeNull();
    });

    it('offers no mark while no Team of the Spiel is followed', async () => {
      const { seite } = await mitAuswahl([]);

      expect(markierKnoepfe(seite)).toEqual([]);
    });

    it("offers no mark in the opponent's Kader", async () => {
      const { seite } = await mitAuswahl([WASBUETTEL]);

      expect(markierKnoepfe(kaderVon(seite, 'MTV Gifhorn'))).toEqual([]);
    });

    it('offers marks in both Kader where both Teams are followed', async () => {
      const { seite } = await mitAuswahl([GIFHORN, WASBUETTEL]);

      expect(markierKnoepfe(kaderVon(seite, 'MTV Wasbüttel'))).toHaveLength(1);
      expect(markierKnoepfe(kaderVon(seite, 'MTV Gifhorn'))).toHaveLength(1);
    });

    it('marks a player as the Kind with a Spitzname, and highlights them with a star', async () => {
      const { seite, auswahl, stabil } = await mitAuswahl([WASBUETTEL]);

      markierKnoepfe(kaderVon(seite, 'MTV Wasbüttel'))[0].click();
      await stabil();
      expect(text(dialog())).toContain('Ilvio Mistelgrund');
      await spitznameEingeben('  Ilvi ', stabil);

      expect(auswahl.children()).toEqual([
        { personId: ILVIO, nickname: 'Ilvi' },
      ]);
      const zeile = zeileVon(kaderVon(seite, 'MTV Wasbüttel'), 'Ilvio');
      expect(zeile.hasAttribute('data-kind')).toBe(true);
      expect(zeile.querySelector('mat-icon.stern')).not.toBeNull();
      expect(text(teil(zeile, 'kader-spitzname'))).toBe('„Ilvi“');
      expect(text(zeile.querySelector('.name'))).toContain('Mein Kind:');
      expect(markierKnoepfe(kaderVon(seite, 'MTV Wasbüttel'))).toEqual([]);
    });

    it('marks a Kind without a Spitzname', async () => {
      const { seite, auswahl, stabil } = await mitAuswahl([WASBUETTEL]);

      markierKnoepfe(kaderVon(seite, 'MTV Wasbüttel'))[0].click();
      await stabil();
      await spitznameEingeben('', stabil);

      expect(auswahl.children()).toEqual([{ personId: ILVIO }]);
      const zeile = zeileVon(kaderVon(seite, 'MTV Wasbüttel'), 'Ilvio');
      expect(teil(zeile, 'kader-spitzname')).toBeNull();
    });

    it('marks nobody where the dialog is cancelled', async () => {
      const { seite, auswahl, stabil } = await mitAuswahl([WASBUETTEL]);

      markierKnoepfe(kaderVon(seite, 'MTV Wasbüttel'))[0].click();
      await stabil();
      knopf(dialog(), 'Abbrechen').click();
      await stabil();

      expect(auswahl.children()).toEqual([]);
    });

    it("highlights a marked Kind only in a followed Team's Kader", async () => {
      const { seite } = await mitAuswahl(
        [WASBUETTEL],
        [{ personId: DELON, nickname: 'Del' }]
      );

      // Delon plays for the opponent here: not one of Meine Teams
      const gast = kaderVon(seite, 'MTV Gifhorn');
      expect(zeileVon(gast, 'Delon').hasAttribute('data-kind')).toBe(false);
      expect(teil(gast, 'kader-spitzname')).toBeNull();
    });

    it('highlights the same Kind in the Kader of each followed Team it plays for', async () => {
      const { seite } = await mitAuswahl(
        [GIFHORN, WASBUETTEL],
        [{ personId: DELON }, { personId: ILVIO }]
      );

      expect(
        zeileVon(kaderVon(seite, 'MTV Gifhorn'), 'Delon').hasAttribute(
          'data-kind'
        )
      ).toBe(true);
      expect(
        zeileVon(kaderVon(seite, 'MTV Wasbüttel'), 'Ilvio').hasAttribute(
          'data-kind'
        )
      ).toBe(true);
    });

    it("changes a marked Kind's Spitzname from its menu", async () => {
      const { seite, auswahl, stabil } = await mitAuswahl(
        [WASBUETTEL],
        [{ personId: ILVIO, nickname: 'Ilvi' }]
      );

      const menue = zeileVon(
        kaderVon(seite, 'MTV Wasbüttel'),
        'Ilvio'
      ).querySelector<HTMLButtonElement>('[data-qa="kind-menue"]');
      expect(menue?.getAttribute('aria-label')).toBe(
        'Mein Kind Ilvio Mistelgrund: Markierung ändern'
      );
      menue?.click();
      await stabil();
      knopf(
        document.querySelector('.mat-mdc-menu-panel'),
        'Spitzname ändern'
      ).click();
      await stabil();
      expect(dialog()?.querySelector('input')?.value).toBe('Ilvi');
      await spitznameEingeben('Ilvo', stabil);

      expect(auswahl.children()).toEqual([
        { personId: ILVIO, nickname: 'Ilvo' },
      ]);
      expect(
        text(teil(kaderVon(seite, 'MTV Wasbüttel'), 'kader-spitzname'))
      ).toBe('„Ilvo“');
    });

    it('unmarks a Kind from its menu', async () => {
      const { seite, auswahl, stabil } = await mitAuswahl(
        [WASBUETTEL],
        [{ personId: ILVIO }]
      );

      zeileVon(kaderVon(seite, 'MTV Wasbüttel'), 'Ilvio')
        .querySelector<HTMLButtonElement>('[data-qa="kind-menue"]')
        ?.click();
      await stabil();
      knopf(
        document.querySelector('.mat-mdc-menu-panel'),
        'Markierung entfernen'
      ).click();
      await stabil();

      expect(auswahl.children()).toEqual([]);
      expect(markierKnoepfe(kaderVon(seite, 'MTV Wasbüttel'))).toHaveLength(1);
    });

    it('says so where the mark could not be stored', async () => {
      const { seite, auswahl, stabil } = await mitAuswahl([WASBUETTEL]);
      vi.spyOn(auswahl, 'mark').mockRejectedValue(new Error('voll'));

      markierKnoepfe(kaderVon(seite, 'MTV Wasbüttel'))[0].click();
      await stabil();
      await spitznameEingeben('Ilvi', stabil);

      expect(text(teil(seite, 'kind-fehler'))).toBe(
        'Das ließ sich nicht speichern. Bitte noch einmal versuchen.'
      );
    });

    it('keeps the reload hint where a newer version stored the selection, the controls gone', async () => {
      const teams = signal<readonly number[]>([WASBUETTEL]);
      const { seite, stabil } = await renderMit(
        fakeData(
          async () => GESPIELT,
          async () => bericht(MIT_WERTEN, OHNE_WERTE)
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

      markierKnoepfe(kaderVon(seite, 'MTV Wasbüttel'))[0].click();
      await stabil();
      await spitznameEingeben('Ilvi', stabil);

      expect(markierKnoepfe(seite)).toEqual([]);
      expect(teil(seite, 'kind-fehler')?.getAttribute('role')).toBe('alert');
      expect(text(teil(seite, 'kind-fehler'))).toContain(
        'Bitte die App neu laden.'
      );
    });

    it('closes the Spitzname dialog where the Team was unfollowed meanwhile, and marks nobody', async () => {
      const { seite, auswahl, stabil } = await mitAuswahl([WASBUETTEL]);
      const markieren = vi.spyOn(auswahl, 'mark');
      markierKnoepfe(kaderVon(seite, 'MTV Wasbüttel'))[0].click();
      await stabil();
      expect(dialog()).not.toBeNull();

      // another tab unfollows the Team: its Kader offers no mark any more
      await auswahl.unfollow(WASBUETTEL);
      await stabil();

      expect(dialog()).toBeNull();
      expect(markieren).not.toHaveBeenCalled();
      expect(auswahl.children()).toEqual([]);
    });

    it('highlights a Kind in both Kader where both Teams are followed and it is in each', async () => {
      const ilvio = MIT_WERTEN.entries[0];
      const { seite } = await mitAuswahl(
        [WASBUETTEL, GIFHORN],
        [{ personId: ILVIO, nickname: 'Ilvi' }],
        bericht(MIT_WERTEN, { ...OHNE_WERTE, entries: [ilvio] })
      );

      for (const team of ['MTV Wasbüttel', 'MTV Gifhorn']) {
        const zeile = zeileVon(kaderVon(seite, team), 'Ilvio');
        expect(zeile.hasAttribute('data-kind')).toBe(true);
        expect(text(teil(zeile, 'kader-spitzname'))).toBe('„Ilvi“');
      }
    });
  });

  describe('each part on its own', () => {
    it('shows the Kader while the Spiel fails', async () => {
      const seite = await render(
        fakeData(
          async () => {
            throw new BasketballDataError('unavailable', 'DBB: nope');
          },
          async () => bericht(OHNE_WERTE, OHNE_WERTE)
        )
      );

      expect(text(teil(seite, 'spiel-fehler'))).toContain(
        'Der DBB ist gerade nicht erreichbar.'
      );
      expect(alle(seite, 'kader')).toHaveLength(2);
    });

    it('shows the Spiel while the Spielbericht fails', async () => {
      const seite = await render(
        fakeData(
          async () => GESPIELT,
          async () => {
            throw new BasketballDataError('unexpected-shape', 'DBB: nope');
          }
        )
      );

      expect(text(teil(seite, 'spiel-ergebnis'))).toBe('78:47');
      expect(text(teil(seite, 'spielbericht-fehler'))).toContain(
        'Die Daten des DBB ließen sich nicht lesen.'
      );
      expect(teil(seite, 'spielbericht-fehlt')).toBeNull();
    });

    it('shows the Spiel while the Spielbericht still loads', async () => {
      const seite = await render(
        fakeData(
          async () => GESPIELT,
          () => NIE
        )
      );

      expect(text(teil(seite, 'spiel-ergebnis'))).toBe('78:47');
      expect(
        seite.querySelector(
          'mat-progress-bar[aria-label="Spielbericht wird geladen"]'
        )
      ).not.toBeNull();
    });

    it('says so when the DBB knows no such Spiel', async () => {
      const seite = await render(
        fakeData(
          async () => {
            throw new BasketballDataError('not-found', 'DBB: nope');
          },
          async () => {
            throw new BasketballDataError('not-found', 'DBB: nope');
          }
        )
      );

      const meldung = seite.querySelector('[role="alert"]');
      expect(text(meldung)).toBe('Dieses Spiel kennt der DBB nicht.');
      // the page's heading first, then what went wrong: no heading after it
      const ueberschriften = seite.querySelectorAll('h1');
      expect(ueberschriften).toHaveLength(1);
      expect(
        ueberschriften[0].compareDocumentPosition(meldung as Node) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    });

    it.each([
      ['unknown', 'not-found', 'Dieses Spiel kennt der DBB nicht.'],
      ['unreachable', 'unavailable', 'Der DBB ist gerade nicht erreichbar.'],
    ] as const)(
      'says it once when the Spiel is %s and its Spielbericht fails too',
      async (_case, kind, meldung) => {
        const seite = await render(
          fakeData(
            async () => {
              throw new BasketballDataError(kind, 'DBB: nope');
            },
            async () => {
              throw new BasketballDataError(kind, 'DBB: nope');
            }
          )
        );

        expect(seite.textContent?.split(meldung)).toHaveLength(2);
        expect(teil(seite, 'spielbericht-fehler')).toBeNull();
        expect(
          [...seite.querySelectorAll('h2')].map((h2) => text(h2))
        ).not.toContain('Kader');
      }
    );
  });

  it.each(['2861436abc', 'abc', '-1', '0'])(
    'shows no Spiel for the id %s, without asking the DBB',
    async (spielId) => {
      const data = fakeData(
        async () => GESPIELT,
        async () => undefined
      );

      const seite = await render(data, spielId);

      expect(text(seite.querySelector('[role="alert"]'))).toBe(
        'Dieses Spiel kennt der DBB nicht.'
      );
      expect(text(seite.querySelector('h1'))).toBe('Spiel');
      expect(data.game).not.toHaveBeenCalled();
      expect(data.gameReport).not.toHaveBeenCalled();
      expect(teil(seite, 'spielbericht-fehlt')).toBeNull();
    }
  );
});
