import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSnackBarHarness } from '@angular/material/snack-bar/testing';
import { provideRouter } from '@angular/router';
import {
  BasketballDataError,
  type NamedPlayer,
  type Venue,
  type League,
  type GameDetails,
  type Game,
  type Participant,
  type GameReport,
  type Team,
  type TeamId,
  type TeamSeason,
  type ClubTeams,
} from '@wolsok/feat-shared-basketball-data';
import { AUSWAHL } from '../auswahl/auswahl';
import { type Auswahl, LokaleAuswahl } from '@wolsok/feat-korbjaeger-auswahl';
import {
  BASKETBALL_DATA,
  type KorbjaegerData,
} from '../basketball-data/basketball-data.provider';
import type { KorbReadOptions } from '../basketball-data/lesung';
import { HEUTE } from '../heute';
import { JETZT } from '../jetzt';
import { MEIN_KIND } from './ueberblick-ansicht';
import { UeberblickComponent } from './ueberblick.component';
import { fakeAuswahl } from '@wolsok/feat-korbjaeger-auswahl/testing';
import { KontoSitzung } from '../konto/konto-sitzung';
import {
  FakeKontoDienst,
  MerkerImSpec,
} from '../konto/testing/fake-konto-dienst';

/** The day the specs run on. */
const HEUTE_IM_SPEC = '2026-11-08';
/** Noon of `HEUTE_IM_SPEC` in Germany. */
const JETZT_IM_SPEC = Date.parse('2026-11-08T12:00:00+01:00');

const VORRUNDE: League = {
  id: 54862,
  name: 'U12 Vorrunde Nord',
  association: { id: 7, name: 'Niedersachsen' },
  ageGroup: 'U12',
  gender: 'mixed',
  division: 'Kreisliga',
};

function team(id: TeamId, name: string): Team {
  return { id, name, clubId: id };
}

const WASBUETTEL = team(313036, 'MTV Wasbüttel');
const WASBUETTEL_U14 = team(313040, 'MTV Wasbüttel U14');
const GIFHORN = team(201500, 'MTV Gifhorn');
const OESINGEN = team(201765, 'SV Groß Oesingen');

function partei(team: Team): Participant {
  return { kind: 'team', team };
}

const GESPIELT_78_47: Game['status'] = {
  kind: 'played',
  result: { home: 78, away: 47 },
  confirmed: true,
};

let naechsteSpielId = 1;

/** A Spiel of `heim` at home against `gast`. */
function spiel(
  heim: Team,
  gast: Team,
  datum: string,
  overrides: Partial<Game> = {}
): Game {
  return {
    id: naechsteSpielId++,
    leagueId: VORRUNDE.id,
    matchday: 1,
    date: datum,
    time: '10:00',
    home: partei(heim),
    away: partei(gast),
    status: { kind: 'scheduled' },
    ...overrides,
  };
}

function saison(von: Team, ...spiele: Game[]): TeamSeason {
  return {
    team: von,
    club: { id: von.clubId, name: von.name },
    leagues: [VORRUNDE],
    games: spiele,
  };
}

type TeamSpieleRead = KorbjaegerData['teamGames'];
type SpielRead = KorbjaegerData['game'];
type VereinsTeamsRead = KorbjaegerData['clubTeams'];
type BerichtRead = KorbjaegerData['gameReport'];

/** No Spiel has a Spielbericht yet. */
const OHNE_BERICHT: BerichtRead = async () => undefined;

/** A Spielbericht read that never settles. */
const NIE_BERICHT = new Promise<never>(() => undefined);

/** What a Kind's card says where not every Team could be read. */
const VIELLEICHT_MEHR =
  'Nicht alles zu deinen Teams ließ sich lesen: Vielleicht spielt dein Kind noch in einem weiteren.';

/** A Verein whose recent Spiele show no Team. */
const OHNE_TEAMS: VereinsTeamsRead = async (vereinId) => ({
  club: { id: vereinId, name: 'Verein' },
  teams: [],
});

/** Where every Spiel of the specs is played, unless one says otherwise. */
const SPORTHALLE: Venue = {
  name: 'Sporthalle am Wasserturm',
  street: 'Turmweg 1',
  postcode: '38518',
  town: 'Gifhorn',
};

/** Every Spiel's details, in the Sporthalle. */
const inDerSporthalle: SpielRead = async (spielId) => ({
  game: spiel(WASBUETTEL, GIFHORN, '2026-11-14', { id: spielId }),
  league: VORRUNDE,
  venue: SPORTHALLE,
  quarters: [],
  overtimes: [],
});

/**
 * `KorbjaegerData` answering each Team's Spiele from `saisons`, and every
 * Spiel's details by `details`.
 */
function fakeData(
  saisons: readonly (TeamSeason | { teamId: TeamId; fehler: Error })[],
  details: SpielRead = inDerSporthalle,
  clubTeams: VereinsTeamsRead = OHNE_TEAMS,
  gameReport: BerichtRead = OHNE_BERICHT
): {
  readonly teamGames: ReturnType<typeof vi.fn<TeamSpieleRead>>;
  readonly game: ReturnType<typeof vi.fn<SpielRead>>;
  readonly clubTeams: ReturnType<typeof vi.fn<VereinsTeamsRead>>;
  readonly gameReport: ReturnType<typeof vi.fn<BerichtRead>>;
} {
  return {
    game: vi.fn<SpielRead>(details),
    clubTeams: vi.fn<VereinsTeamsRead>(clubTeams),
    gameReport: vi.fn<BerichtRead>(gameReport),
    teamGames: vi.fn<TeamSpieleRead>(async (teamId) => {
      const gefunden = saisons.find((s) =>
        'fehler' in s ? s.teamId === teamId : s.team.id === teamId
      );
      if (gefunden === undefined || 'fehler' in gefunden) {
        throw gefunden?.fehler ?? new BasketballDataError('not-found', '');
      }
      return gefunden;
    }),
  };
}

/**
 * Renders the overview on `data`, following `gefolgt` (or with that
 * `Auswahl`), once the reads that settle have settled.
 */
async function render(
  data: Pick<KorbjaegerData, 'teamGames' | 'game' | 'clubTeams' | 'gameReport'>,
  gefolgt: readonly TeamId[] | Auswahl
): Promise<{
  readonly seite: HTMLElement;
  readonly auswahl: Auswahl;
  /** Waits for the reads that settle and the page. */
  readonly stabil: () => Promise<void>;
  /** The snackbars, open over the page (`document`'s root). */
  readonly leisten: HarnessLoader;
}> {
  const auswahl = 'teams' in gefolgt ? gefolgt : await folgend(gefolgt);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: BASKETBALL_DATA, useValue: data },
      { provide: HEUTE, useValue: signal(HEUTE_IM_SPEC) },
      { provide: JETZT, useValue: signal(JETZT_IM_SPEC) },
      { provide: AUSWAHL, useValue: auswahl },
    ],
  });
  const fixture = TestBed.createComponent(UeberblickComponent);
  // not whenStable: it waits for every read, and some never settle here
  const stabil = async (): Promise<void> => {
    // the Kader search starts once a Saison is read, reading on a Spiel
    // at a time: a few rounds let it settle
    for (let runde = 0; runde < 8; runde++) {
      fixture.detectChanges();
      await new Promise((resolve) => setTimeout(resolve));
    }
    fixture.detectChanges();
  };
  await stabil();
  return {
    seite: fixture.nativeElement as HTMLElement,
    auswahl,
    stabil,
    leisten: TestbedHarnessEnvironment.documentRootLoader(fixture),
  };
}

async function folgend(teams: readonly TeamId[]): Promise<LokaleAuswahl> {
  const auswahl = new LokaleAuswahl(undefined);
  for (const teamId of teams) {
    await auswahl.folgen(teamId);
  }
  return auswahl;
}

function eintraege(seite: HTMLElement): HTMLElement[] {
  return [
    ...seite.querySelectorAll<HTMLElement>('[data-qa="ueberblick-team"]'),
  ];
}

function text(element: Element | null | undefined): string | undefined {
  return element?.textContent?.replace(/\s+/g, ' ').trim();
}

function teil(eintrag: HTMLElement, name: string): HTMLElement | null {
  return eintrag.querySelector<HTMLElement>(`[data-qa="ueberblick-${name}"]`);
}

function teamNamen(seite: HTMLElement): (string | undefined)[] {
  return eintraege(seite).map((eintrag) => text(teil(eintrag, 'name')));
}

describe('UeberblickComponent', () => {
  it('claims nothing before Meine Teams are read', async () => {
    const data = fakeData([]);

    const { seite } = await render(
      data,
      fakeAuswahl({
        teams: signal(undefined),
        kinder: signal(undefined),
      })
    );

    expect(seite.querySelector('[data-qa="ueberblick-leer"]')).toBeNull();
    expect(eintraege(seite)).toEqual([]);
    expect(data.teamGames).not.toHaveBeenCalled();
  });

  it('says the account cannot be read, rather than show what it read before', async () => {
    const dienst = new FakeKontoDienst();
    const sitzung = new KontoSitzung(
      new LokaleAuswahl(undefined),
      async () => dienst,
      new MerkerImSpec()
    );
    await sitzung.starten();
    await sitzung.anmelden();
    await dienst.kontoAuswahl.folgen(WASBUETTEL.id);
    const { seite, stabil } = await render(
      fakeData([saison(WASBUETTEL)]),
      sitzung.auswahl
    );
    expect(teamNamen(seite)).toEqual(['MTV Wasbüttel']);

    dienst.lesefehler?.({ code: 'unavailable' });
    await stabil();

    expect(
      text(seite.querySelector('[data-qa="ueberblick-nicht-lesbar"]'))
    ).toBe(
      'Meine Teams und Kinder lassen sich gerade nicht lesen. Bitte die App neu laden.'
    );
    expect(eintraege(seite)).toEqual([]);
  });

  it('invites to follow a first Team while none is followed', async () => {
    const data = fakeData([]);

    const { seite } = await render(data, []);

    expect(eintraege(seite)).toEqual([]);
    expect(text(seite.querySelector('[data-qa="ueberblick-leer"]'))).toContain(
      'Du folgst noch keinem Team.'
    );
    expect(data.teamGames).not.toHaveBeenCalled();
  });

  it('offers to set up a first Team while none is followed', async () => {
    const { seite } = await render(fakeData([]), []);

    const link = seite.querySelector<HTMLAnchorElement>(
      '[data-qa="ueberblick-leer"] a'
    );
    expect(text(link)).toBe('Team suchen');
    expect(link?.getAttribute('href')).toBe('/suchen');
  });

  it("labels a card with its Team's last good Spiele and their age", async () => {
    const data = fakeData([]);
    data.teamGames.mockImplementation(
      async (_team, options?: KorbReadOptions) => {
        options?.lesung?.ersetzt({
          gespeichertAm: JETZT_IM_SPEC - 3 * 60 * 60_000,
          grund: 'kein-internet',
        });
        return saison(WASBUETTEL);
      }
    );

    const { seite } = await render(data, [WASBUETTEL.id]);

    expect(text(teil(eintraege(seite)[0], 'stand'))).toContain(
      'Offline · Stand: vor 3 Std.'
    );
  });

  it("labels a card with the oldest Stand of what it shows, its next Spiel's Halle too", async () => {
    const STUNDE = 60 * 60_000;
    const data = fakeData([], async (spielId, options?: KorbReadOptions) => {
      options?.lesung?.ersetzt({
        gespeichertAm: JETZT_IM_SPEC - 3 * STUNDE,
        grund: 'unavailable',
      });
      return inDerSporthalle(spielId);
    });
    data.teamGames.mockImplementation(
      async (_team, options?: KorbReadOptions) => {
        options?.lesung?.ersetzt({
          gespeichertAm: JETZT_IM_SPEC - STUNDE,
          grund: 'kein-internet',
        });
        return saison(WASBUETTEL, spiel(GIFHORN, WASBUETTEL, '2026-11-14'));
      }
    );

    const { seite, stabil } = await render(data, [WASBUETTEL.id]);
    // the Halle is read once its card is there
    await stabil();

    expect(text(teil(eintraege(seite)[0], 'stand'))).toContain(
      'DBB nicht erreichbar · Stand: vor 3 Std.'
    );
  });

  it('labels no card whose Spiele were just read', async () => {
    const { seite } = await render(fakeData([saison(WASBUETTEL)]), [
      WASBUETTEL.id,
    ]);

    expect(teil(eintraege(seite)[0], 'stand')?.textContent?.trim() ?? '').toBe(
      ''
    );
  });

  it('offers no set-up once a Team is followed', async () => {
    const { seite } = await render(fakeData([saison(WASBUETTEL)]), [
      WASBUETTEL.id,
    ]);

    expect(seite.querySelector('a[href="/suchen"]')).toBeNull();
  });

  it('shows the next Spiel with day, time, home or away and opponent', async () => {
    const { seite } = await render(
      fakeData([
        saison(
          WASBUETTEL,
          spiel(GIFHORN, WASBUETTEL, '2026-11-14', { time: '15:30' })
        ),
      ]),
      [WASBUETTEL.id]
    );

    const naechstes = teil(eintraege(seite)[0], 'naechstes');
    expect(text(naechstes)).toContain('Nächstes Spiel');
    expect(text(naechstes)).toContain('Sa., 14.11.2026');
    expect(text(naechstes)).toContain('15:30 Uhr');
    expect(text(naechstes)).toContain('Auswärts gegen MTV Gifhorn');
  });

  it('shows the last result with the next Spiel', async () => {
    const { seite } = await render(
      fakeData([
        saison(
          WASBUETTEL,
          spiel(WASBUETTEL, GIFHORN, '2026-10-17', { status: GESPIELT_78_47 }),
          spiel(OESINGEN, WASBUETTEL, '2026-11-14')
        ),
      ]),
      [WASBUETTEL.id]
    );

    const [eintrag] = eintraege(seite);
    expect(text(teil(eintrag, 'naechstes'))).toContain(
      'gegen SV Groß Oesingen'
    );
    const letztes = text(teil(eintrag, 'letztes'));
    expect(letztes).toContain('Letztes Ergebnis');
    expect(letztes).toContain('Heim gegen MTV Gifhorn');
    expect(letztes).toContain('78:47');
  });

  it('shows only the last result of a Team with no Spiel to come', async () => {
    const { seite } = await render(
      fakeData([
        saison(
          WASBUETTEL,
          spiel(WASBUETTEL, GIFHORN, '2026-10-17', { status: GESPIELT_78_47 })
        ),
      ]),
      [WASBUETTEL.id]
    );

    const [eintrag] = eintraege(seite);
    expect(teil(eintrag, 'naechstes')).toBeNull();
    expect(text(teil(eintrag, 'letztes'))).toContain('78:47');
  });

  it('says so for a Team without Spiele', async () => {
    const { seite } = await render(fakeData([saison(WASBUETTEL)]), [
      WASBUETTEL.id,
    ]);

    expect(text(eintraege(seite)[0])).toContain(
      'Noch keine Spiele in dieser Saison.'
    );
  });

  it('orders Meine Teams by their next Spiel, Teams with none last', async () => {
    const { seite } = await render(
      fakeData([
        saison(
          OESINGEN,
          spiel(OESINGEN, GIFHORN, '2026-10-17', { status: GESPIELT_78_47 })
        ),
        saison(GIFHORN, spiel(GIFHORN, OESINGEN, '2026-11-21')),
        saison(
          WASBUETTEL,
          spiel(WASBUETTEL, GIFHORN, '2026-11-14', { time: '16:00' })
        ),
        saison(
          WASBUETTEL_U14,
          spiel(WASBUETTEL_U14, OESINGEN, '2026-11-14', { time: '11:00' })
        ),
      ]),
      [OESINGEN.id, GIFHORN.id, WASBUETTEL.id, WASBUETTEL_U14.id]
    );

    expect(teamNamen(seite)).toEqual([
      'MTV Wasbüttel U14',
      'MTV Wasbüttel',
      'MTV Gifhorn',
      'SV Groß Oesingen',
    ]);
  });

  it('shows a cancelled Spiel before the next one as cancelled', async () => {
    const { seite } = await render(
      fakeData([
        saison(
          WASBUETTEL,
          spiel(WASBUETTEL, OESINGEN, '2026-11-14', {
            status: { kind: 'cancelled' },
          }),
          spiel(WASBUETTEL, GIFHORN, '2026-11-21')
        ),
      ]),
      [WASBUETTEL.id]
    );

    const [eintrag] = eintraege(seite);
    const abgesagt = text(teil(eintrag, 'ausfall'));
    expect(abgesagt).toContain('Fällt aus');
    expect(abgesagt).toContain('abgesagt');
    expect(abgesagt).toContain('Sa., 14.11.2026');
    expect(abgesagt).toContain('gegen SV Groß Oesingen');
    expect(text(teil(eintrag, 'naechstes'))).toContain('gegen MTV Gifhorn');
  });

  it('shows a forfeited Spiel as forfeited, to come or last', async () => {
    const { seite } = await render(
      fakeData([
        saison(
          WASBUETTEL,
          spiel(WASBUETTEL, GIFHORN, '2026-10-17', {
            status: {
              kind: 'forfeited',
              forfeitedBy: ['away'],
              result: { home: 20, away: 0 },
            },
          }),
          spiel(OESINGEN, WASBUETTEL, '2026-11-14', {
            status: { kind: 'forfeited', forfeitedBy: ['home'] },
          })
        ),
      ]),
      [WASBUETTEL.id]
    );

    const [eintrag] = eintraege(seite);
    expect(teil(eintrag, 'naechstes')).toBeNull();
    expect(text(teil(eintrag, 'ausfall'))).toContain('kampflos');
    expect(text(teil(eintrag, 'letztes'))).toContain('kampflos');
    expect(text(teil(eintrag, 'letztes'))).toContain('20:0');
  });

  it('links each Team to its Team page', async () => {
    const { seite } = await render(fakeData([saison(WASBUETTEL)]), [
      WASBUETTEL.id,
    ]);

    expect(eintraege(seite)[0].querySelector('a')?.getAttribute('href')).toBe(
      '/team/313036'
    );
  });

  it("opens a Spiel's page from its card, the Team link kept", async () => {
    const { seite } = await render(
      fakeData([
        saison(
          WASBUETTEL,
          spiel(WASBUETTEL, GIFHORN, '2026-10-17', {
            id: 2861436,
            status: GESPIELT_78_47,
          }),
          spiel(OESINGEN, WASBUETTEL, '2026-11-14', { id: 2861445 })
        ),
      ]),
      [WASBUETTEL.id]
    );

    const [eintrag] = eintraege(seite);
    const ziele = [...eintrag.querySelectorAll('a[href^="/"]')].map((a) =>
      a.getAttribute('href')
    );
    expect(ziele).toEqual(['/team/313036', '/spiel/2861445', '/spiel/2861436']);
  });

  describe("the next Spiel's Halle", () => {
    it('shows it with a link that opens navigation', async () => {
      const { seite, stabil } = await render(
        fakeData([
          saison(WASBUETTEL, spiel(GIFHORN, WASBUETTEL, '2026-11-14')),
        ]),
        [WASBUETTEL.id]
      );
      // the Halle is read once its card is there
      await stabil();

      const naechstes = teil(eintraege(seite)[0], 'naechstes');
      expect(text(naechstes?.querySelector('[data-qa="halle-name"]'))).toBe(
        'Sporthalle am Wasserturm'
      );
      const navigation = naechstes?.querySelector(
        '[data-qa="halle-navigation"]'
      );
      expect(navigation?.getAttribute('rel')).toBe('noopener');
      expect(navigation?.getAttribute('href')).toBe(
        'https://www.google.com/maps/search/?api=1&query=Sporthalle%20am%20Wasserturm%2C%20Turmweg%201%2C%2038518%20Gifhorn'
      );
    });

    it('reads the Halle of each next Spiel only', async () => {
      const naechstesWasbuettel = spiel(WASBUETTEL, GIFHORN, '2026-11-14');
      const naechstesGifhorn = spiel(GIFHORN, OESINGEN, '2026-11-21');
      const data = fakeData([
        saison(
          WASBUETTEL,
          spiel(WASBUETTEL, OESINGEN, '2026-10-17', { status: GESPIELT_78_47 }),
          naechstesWasbuettel,
          spiel(OESINGEN, WASBUETTEL, '2026-11-28')
        ),
        saison(GIFHORN, naechstesGifhorn),
        saison(
          OESINGEN,
          spiel(OESINGEN, GIFHORN, '2026-10-17', { status: GESPIELT_78_47 })
        ),
      ]);

      await render(data, [WASBUETTEL.id, GIFHORN.id, OESINGEN.id]);

      expect(data.game.mock.calls.map(([spielId]) => spielId)).toEqual(
        expect.arrayContaining([naechstesWasbuettel.id, naechstesGifhorn.id])
      );
      expect(data.game).toHaveBeenCalledTimes(2);
    });

    it("keeps a card and the others when one card's Halle fails", async () => {
      const gifhorns = spiel(GIFHORN, OESINGEN, '2026-11-21');
      const { seite, stabil } = await render(
        fakeData(
          [
            saison(WASBUETTEL, spiel(WASBUETTEL, OESINGEN, '2026-11-14')),
            saison(GIFHORN, gifhorns),
          ],
          async (spielId) => {
            if (spielId === gifhorns.id) {
              throw new BasketballDataError('unavailable', 'DBB: nope');
            }
            return inDerSporthalle(spielId);
          }
        ),
        [WASBUETTEL.id, GIFHORN.id]
      );
      await stabil();

      const [wasbuettel, gifhorn] = eintraege(seite);
      expect(text(wasbuettel.querySelector('[data-qa="halle-name"]'))).toBe(
        'Sporthalle am Wasserturm'
      );
      expect(text(gifhorn.querySelector('[data-qa="halle-fehler"]'))).toContain(
        'Der DBB ist gerade nicht erreichbar.'
      );
      expect(text(teil(gifhorn, 'naechstes'))).toContain(
        'gegen SV Groß Oesingen'
      );
    });
  });

  it('keeps the other Teams when one fails', async () => {
    const { seite } = await render(
      fakeData([
        saison(WASBUETTEL, spiel(WASBUETTEL, GIFHORN, '2026-11-14')),
        {
          teamId: GIFHORN.id,
          fehler: new BasketballDataError('unavailable', 'DBB: nope'),
        },
      ]),
      [GIFHORN.id, WASBUETTEL.id]
    );

    const [wasbuettel, gifhorn] = eintraege(seite);
    expect(text(teil(wasbuettel, 'naechstes'))).toContain('gegen MTV Gifhorn');
    expect(text(teil(gifhorn, 'fehler'))).toContain(
      'Der DBB ist gerade nicht erreichbar.'
    );
    expect(gifhorn.querySelector('a')?.getAttribute('href')).toBe(
      '/team/201500'
    );
  });

  describe('each Team on its own', () => {
    const NIE: Promise<TeamSeason> = new Promise(() => undefined);
    const NIE_DETAILS: Promise<GameDetails> = new Promise(() => undefined);

    it('shows a Team while another still loads', async () => {
      const { seite } = await render(
        {
          game: inDerSporthalle,
          clubTeams: OHNE_TEAMS,
          gameReport: OHNE_BERICHT,
          teamGames: async (teamId) =>
            teamId === GIFHORN.id
              ? NIE
              : saison(WASBUETTEL, spiel(WASBUETTEL, GIFHORN, '2026-11-14')),
        },
        [GIFHORN.id, WASBUETTEL.id]
      );

      const [wasbuettel, gifhorn] = eintraege(seite);
      expect(text(teil(wasbuettel, 'naechstes'))).toContain(
        'gegen MTV Gifhorn'
      );
      expect(gifhorn.querySelector('mat-progress-bar')).not.toBeNull();
    });

    it('reads no other Team again when one is followed or unfollowed', async () => {
      const data = fakeData([
        saison(WASBUETTEL, spiel(WASBUETTEL, GIFHORN, '2026-11-14')),
        saison(GIFHORN, spiel(GIFHORN, OESINGEN, '2026-11-21')),
        saison(OESINGEN),
      ]);
      const { seite, auswahl, stabil } = await render(data, [
        WASBUETTEL.id,
        OESINGEN.id,
      ]);

      await auswahl.folgen(GIFHORN.id);
      await stabil();
      await auswahl.entfolgen(OESINGEN.id);
      await stabil();

      expect(teamNamen(seite)).toEqual(['MTV Wasbüttel', 'MTV Gifhorn']);
      expect(data.teamGames.mock.calls.map(([teamId]) => teamId)).toEqual([
        WASBUETTEL.id,
        OESINGEN.id,
        GIFHORN.id,
      ]);
    });

    it('cancels the read of a Team unfollowed while it loads', async () => {
      const data = fakeData([]);
      data.teamGames.mockImplementation(() => NIE);
      const { auswahl, stabil } = await render(data, [GIFHORN.id]);
      const lesung = data.teamGames.mock.calls[0][1]?.signal;

      await auswahl.entfolgen(GIFHORN.id);
      await stabil();

      expect(lesung?.aborted).toBe(true);
    });

    it("cancels the next Spiel's Halle read of a Team unfollowed", async () => {
      const data = fakeData(
        [saison(GIFHORN, spiel(GIFHORN, OESINGEN, '2026-11-21'))],
        () => NIE_DETAILS
      );
      const { auswahl, stabil } = await render(data, [GIFHORN.id]);
      await stabil();
      const lesung = data.game.mock.calls[0][1]?.signal;
      expect(lesung?.aborted).toBe(false);

      await auswahl.entfolgen(GIFHORN.id);
      await stabil();

      expect(lesung?.aborted).toBe(true);
    });

    it("reads no Halle before a Team's next Spiel is known", async () => {
      const data = fakeData([]);
      data.teamGames.mockImplementation(() => NIE);

      await render(data, [GIFHORN.id]);

      expect(data.game).not.toHaveBeenCalled();
    });

    it('puts a Team in its place once it has loaded', async () => {
      let gifhornLaden: (saison: TeamSeason) => void = () => undefined;
      const { seite, stabil } = await render(
        {
          game: inDerSporthalle,
          clubTeams: OHNE_TEAMS,
          gameReport: OHNE_BERICHT,
          teamGames: (teamId) =>
            teamId === GIFHORN.id
              ? new Promise((resolve) => (gifhornLaden = resolve))
              : Promise.resolve(
                  saison(WASBUETTEL, spiel(WASBUETTEL, OESINGEN, '2026-11-21'))
                ),
        },
        [WASBUETTEL.id, GIFHORN.id]
      );
      expect(teamNamen(seite)[0]).toBe('MTV Wasbüttel');

      gifhornLaden(saison(GIFHORN, spiel(GIFHORN, OESINGEN, '2026-11-14')));
      await stabil();

      expect(teamNamen(seite)).toEqual(['MTV Gifhorn', 'MTV Wasbüttel']);
    });

    /** The card's control to unfollow its Team. */
    function nichtMehrFolgen(eintrag: Element): HTMLButtonElement | null {
      return eintrag.querySelector<HTMLButtonElement>(
        '[data-qa="ueberblick-aktionen"] [data-qa="team-folgen"]'
      );
    }

    it('unfollows a Team whose read fails from its card', async () => {
      const { seite, auswahl, stabil } = await render(
        fakeData([
          saison(WASBUETTEL),
          {
            teamId: GIFHORN.id,
            fehler: new BasketballDataError('not-found', 'DBB: nope'),
          },
        ]),
        [GIFHORN.id, WASBUETTEL.id]
      );
      const [gifhorn] = eintraege(seite);
      expect(text(teil(gifhorn, 'name'))).toBe('Team 201500');
      const knopf = nichtMehrFolgen(gifhorn);
      expect(knopf?.getAttribute('aria-label')).toBe(
        'Nicht mehr folgen: Team 201500'
      );

      knopf?.click();
      await stabil();

      expect(auswahl.teams()).toEqual([WASBUETTEL.id]);
      expect(teamNamen(seite)).toEqual(['MTV Wasbüttel']);
    });

    it('unfollows a Team that loaded from its card, offering to undo it', async () => {
      const { seite, auswahl, stabil, leisten } = await render(
        fakeData([saison(WASBUETTEL), saison(GIFHORN)]),
        [WASBUETTEL.id, GIFHORN.id]
      );
      await stabil();
      const [wasbuettel] = eintraege(seite);
      const knopf = nichtMehrFolgen(wasbuettel);
      expect(knopf?.getAttribute('aria-label')).toBe(
        'Nicht mehr folgen: MTV Wasbüttel'
      );

      knopf?.click();
      await stabil();

      expect(auswahl.teams()).toEqual([GIFHORN.id]);
      expect(teamNamen(seite)).toEqual(['MTV Gifhorn']);
      // focus stays on the overview, not on the page's body
      expect(document.activeElement?.textContent?.trim()).toBe('Meine Teams');
      const leiste = await leisten.getHarness(MatSnackBarHarness);
      expect(await leiste.getMessage()).toBe(
        'MTV Wasbüttel steht nicht mehr in Meine Teams.'
      );

      await leiste.dismissWithAction();
      await stabil();

      expect(auswahl.teams()).toEqual([GIFHORN.id, WASBUETTEL.id]);
      TestBed.inject(MatSnackBar).dismiss();
    });
  });

  describe('the end of the Saison', () => {
    /** Wasbüttel's Verein: the Team itself and its U14. */
    const WASBUETTELS_VEREIN: ClubTeams = {
      club: { id: WASBUETTEL.clubId, name: 'MTV Wasbüttel' },
      teams: [
        { team: WASBUETTEL, leagues: [VORRUNDE] },
        {
          team: WASBUETTEL_U14,
          leagues: [{ ...VORRUNDE, id: 54900, name: 'U14 Regionsliga' }],
        },
      ],
    };

    function mitLetztemSpielAm(datum: string) {
      return fakeData(
        [
          saison(
            WASBUETTEL,
            spiel(WASBUETTEL, GIFHORN, datum, { status: GESPIELT_78_47 })
          ),
        ],
        inDerSporthalle,
        async () => WASBUETTELS_VEREIN
      );
    }

    it("says no Spiel is set for a Team and suggests its Verein's current Teams", async () => {
      // more than two weeks before 8 November
      const data = mitLetztemSpielAm('2026-10-17');

      const { seite, stabil } = await render(data, [WASBUETTEL.id]);
      // the Verein is read once its card is there
      await stabil();

      const hinweis = teil(eintraege(seite)[0], 'saison-beendet');
      expect(text(hinweis)).toContain('Keine Spiele mehr angesetzt.');
      expect(data.clubTeams).toHaveBeenCalledWith(
        WASBUETTEL.clubId,
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
      expect(
        [
          ...(hinweis?.querySelectorAll('[data-qa="vereins-team-name"]') ?? []),
        ].map((name) => text(name))
      ).toEqual(['MTV Wasbüttel U14']);
      expect(text(teil(eintraege(seite)[0], 'letztes'))).toContain('78:47');
    });

    it('reads a Verein once for two of its Teams whose Saison looks over', async () => {
      const u14: Team = { ...WASBUETTEL_U14, clubId: WASBUETTEL.clubId };
      const data = fakeData(
        [
          saison(
            WASBUETTEL,
            spiel(WASBUETTEL, GIFHORN, '2026-10-17', { status: GESPIELT_78_47 })
          ),
          saison(
            u14,
            spiel(u14, OESINGEN, '2026-10-10', { status: GESPIELT_78_47 })
          ),
        ],
        inDerSporthalle,
        async () => WASBUETTELS_VEREIN
      );

      const { seite, stabil } = await render(data, [WASBUETTEL.id, u14.id]);
      await stabil();

      expect(data.clubTeams).toHaveBeenCalledTimes(1);
      const vorschlaege = eintraege(seite).map((eintrag) =>
        [
          ...(teil(eintrag, 'saison-beendet')?.querySelectorAll(
            '[data-qa="vereins-team-name"]'
          ) ?? []),
        ].map((name) => text(name))
      );
      expect(vorschlaege).toEqual([['MTV Wasbüttel U14'], ['MTV Wasbüttel']]);
    });

    it('follows a suggested Team from the card', async () => {
      const { seite, auswahl, stabil } = await render(
        mitLetztemSpielAm('2026-10-17'),
        [WASBUETTEL.id]
      );
      await stabil();

      teil(eintraege(seite)[0], 'saison-beendet')
        ?.querySelector<HTMLButtonElement>('[data-qa="team-folgen"]')
        ?.click();
      await stabil();

      expect(auswahl.teams()).toEqual([WASBUETTEL.id, WASBUETTEL_U14.id]);
    });

    it('unfollows a suggested Team from the card, focus left on its control, no undo', async () => {
      const { seite, auswahl, stabil, leisten } = await render(
        mitLetztemSpielAm('2026-10-17'),
        [WASBUETTEL.id]
      );
      await stabil();
      const knopf = () =>
        teil(
          eintraege(seite)[0],
          'saison-beendet'
        )?.querySelector<HTMLButtonElement>('[data-qa="team-folgen"]');
      knopf()?.click();
      await stabil();
      knopf()?.focus();

      knopf()?.click();
      await stabil();

      expect(auswahl.teams()).toEqual([WASBUETTEL.id]);
      expect(document.activeElement).toBe(knopf());
      expect(await leisten.getHarnessOrNull(MatSnackBarHarness)).toBeNull();
    });

    it('says nothing and reads no Verein exactly two weeks after the last Spiel', async () => {
      const data = mitLetztemSpielAm('2026-10-25');

      const { seite } = await render(data, [WASBUETTEL.id]);

      expect(teil(eintraege(seite)[0], 'saison-beendet')).toBeNull();
      expect(data.clubTeams).not.toHaveBeenCalled();
    });

    it('says nothing for a Team without Spiele', async () => {
      const data = fakeData([saison(WASBUETTEL)]);

      const { seite } = await render(data, [WASBUETTEL.id]);

      expect(teil(eintraege(seite)[0], 'saison-beendet')).toBeNull();
      expect(data.clubTeams).not.toHaveBeenCalled();
    });

    it('keeps the card when the Verein cannot be read', async () => {
      const { seite, stabil } = await render(
        fakeData(
          [
            saison(
              WASBUETTEL,
              spiel(WASBUETTEL, GIFHORN, '2026-10-17', {
                status: GESPIELT_78_47,
              })
            ),
          ],
          inDerSporthalle,
          async () => {
            throw new BasketballDataError('unavailable', 'DBB: nope');
          }
        ),
        [WASBUETTEL.id]
      );
      await stabil();

      const [eintrag] = eintraege(seite);
      expect(text(teil(eintrag, 'letztes'))).toContain('78:47');
      expect(
        text(eintrag.querySelector('[data-qa="vereins-teams-fehler"]'))
      ).toContain('Der DBB ist gerade nicht erreichbar.');
    });
  });

  describe('the Kinder', () => {
    function benannt(personId: number, vorname: string): NamedPlayer {
      return {
        kind: 'named',
        personId,
        firstName: vorname,
        lastName: 'Ahornwiese',
      };
    }

    const LUMI = benannt(4711, 'Lumi');
    const MORVO = benannt(4712, 'Morvo');
    const NELKA = benannt(4713, 'Nelka');

    /**
     * Spielberichte by Spiel: the home Kader as given, an Anonymer Spieler
     * and a player of the other Team on the away side.
     */
    function berichte(
      heimKader: Readonly<Record<number, readonly NamedPlayer[]>>,
      gastKader: Readonly<Record<number, readonly NamedPlayer[]>> = {}
    ): BerichtRead {
      return async (spielId): Promise<GameReport | undefined> => {
        const heim = heimKader[spielId];
        const gast = gastKader[spielId];
        if (heim === undefined && gast === undefined) {
          return undefined;
        }
        return {
          gameId: spielId,
          home: {
            playerStatsRecorded: false,
            entries: [...(heim ?? []), { kind: 'anonymous' }],
          },
          away: { playerStatsRecorded: false, entries: [...(gast ?? [])] },
        };
      };
    }

    async function mitKindern(
      teams: readonly TeamId[],
      kinder: readonly (readonly [NamedPlayer, string?])[]
    ): Promise<LokaleAuswahl> {
      const auswahl = await folgend(teams);
      for (const [spieler, spitzname] of kinder) {
        await auswahl.markieren(spieler, spitzname);
      }
      return auswahl;
    }

    function kinderAbschnitte(seite: HTMLElement): HTMLElement[] {
      return [
        ...seite.querySelectorAll<HTMLElement>('[data-qa="ueberblick-kind"]'),
      ];
    }

    function kindNamen(seite: HTMLElement): (string | undefined)[] {
      return kinderAbschnitte(seite).map((abschnitt) =>
        text(teil(abschnitt, 'kind-name'))
      );
    }

    const GESPIELT_AM = (datum: string) =>
      ({ status: GESPIELT_78_47, time: '10:00', date: datum }) as const;

    it('groups the overview by Kind, with the Teams it plays for, and lists the others below', async () => {
      const letztesWas = spiel(WASBUETTEL, GIFHORN, '2026-11-01', {
        status: GESPIELT_78_47,
      });
      const letztesOes = spiel(OESINGEN, GIFHORN, '2026-11-01', {
        status: GESPIELT_78_47,
      });
      const data = fakeData(
        [
          saison(
            WASBUETTEL,
            letztesWas,
            spiel(WASBUETTEL, OESINGEN, '2026-11-21')
          ),
          saison(OESINGEN, letztesOes, spiel(OESINGEN, GIFHORN, '2026-11-14')),
        ],
        inDerSporthalle,
        OHNE_TEAMS,
        berichte({ [letztesWas.id]: [LUMI], [letztesOes.id]: [NELKA] })
      );

      const { seite } = await render(
        data,
        await mitKindern([WASBUETTEL.id, OESINGEN.id], [[LUMI, 'Lu']])
      );

      const [lumi] = kinderAbschnitte(seite);
      expect(kindNamen(seite)).toEqual(['Lu']);
      expect(text(teil(lumi, 'kind-teams'))).toBe('MTV Wasbüttel');
      expect(text(teil(lumi, 'naechstes'))).toContain('Sa., 21.11.2026');
      // one Team: no need to name it again
      expect(text(teil(lumi, 'naechstes'))).not.toContain('Nächstes Spiel ·');
      expect(text(teil(lumi, 'letztes'))).toContain('78:47');
      expect(text(teil(lumi, 'kader'))).toBe('check_circle Im Kader');
      expect(text(seite.querySelector('[data-qa="ueberblick-weitere"]'))).toBe(
        'Weitere Teams'
      );
      expect(teamNamen(seite)).toEqual(['SV Groß Oesingen']);
    });

    it("unfollows a Kind's Team from its card, focus on the overview", async () => {
      const letztesWas = spiel(WASBUETTEL, GIFHORN, '2026-11-01', {
        status: GESPIELT_78_47,
      });
      const data = fakeData(
        [saison(WASBUETTEL, letztesWas), saison(OESINGEN)],
        inDerSporthalle,
        OHNE_TEAMS,
        berichte({ [letztesWas.id]: [LUMI] })
      );
      const { seite, auswahl, stabil } = await render(
        data,
        await mitKindern([WASBUETTEL.id, OESINGEN.id], [[LUMI, 'Lu']])
      );
      const [lumi] = kinderAbschnitte(seite);
      const knoepfe = [
        ...lumi.querySelectorAll<HTMLButtonElement>(
          '[data-qa="ueberblick-kind-aktionen"] [data-qa="team-folgen"]'
        ),
      ];
      expect(knoepfe.map((knopf) => knopf.getAttribute('aria-label'))).toEqual([
        'Nicht mehr folgen: MTV Wasbüttel',
      ]);

      knoepfe[0].click();
      await stabil();

      expect(auswahl.teams()).toEqual([OESINGEN.id]);
      expect(document.activeElement?.textContent?.trim()).toBe('Meine Teams');
      TestBed.inject(MatSnackBar).dismiss();
    });

    it('shows the same Kind once across two Teams, with the first next Spiel of both', async () => {
      const letztesU12 = spiel(WASBUETTEL, GIFHORN, '2026-10-31', {
        status: GESPIELT_78_47,
      });
      const letztesU14 = spiel(WASBUETTEL_U14, GIFHORN, '2026-11-07', {
        status: GESPIELT_78_47,
      });
      const data = fakeData(
        [
          saison(
            WASBUETTEL,
            letztesU12,
            spiel(WASBUETTEL, GIFHORN, '2026-11-21')
          ),
          saison(
            WASBUETTEL_U14,
            letztesU14,
            spiel(WASBUETTEL_U14, OESINGEN, '2026-11-14')
          ),
        ],
        inDerSporthalle,
        OHNE_TEAMS,
        berichte({ [letztesU12.id]: [LUMI], [letztesU14.id]: [LUMI] })
      );

      const { seite } = await render(
        data,
        await mitKindern([WASBUETTEL.id, WASBUETTEL_U14.id], [[LUMI]])
      );

      expect(kinderAbschnitte(seite)).toHaveLength(1);
      const [lumi] = kinderAbschnitte(seite);
      // no Spitzname: the first name its Kader gives, read fresh
      expect(text(teil(lumi, 'kind-name'))).toBe('Lumi');
      expect(text(teil(lumi, 'kind-teams'))).toBe(
        'MTV Wasbüttel · MTV Wasbüttel U14'
      );
      // each Team's "Nicht mehr folgen" beside its name, for all to see
      expect(
        [...lumi.querySelectorAll('[data-qa="ueberblick-kind-aktion"]')].map(
          (aktion) => [
            text(aktion.querySelector('.team-name')),
            aktion
              .querySelector('[data-qa="team-folgen"]')
              ?.getAttribute('aria-label'),
          ]
        )
      ).toEqual([
        ['MTV Wasbüttel', 'Nicht mehr folgen: MTV Wasbüttel'],
        ['MTV Wasbüttel U14', 'Nicht mehr folgen: MTV Wasbüttel U14'],
      ]);
      expect(text(teil(lumi, 'naechstes'))).toContain('Sa., 14.11.2026');
      expect(text(teil(lumi, 'naechstes'))).toContain('SV Groß Oesingen');
      // which of its Teams plays
      expect(text(teil(lumi, 'naechstes'))).toContain(
        'Nächstes Spiel · MTV Wasbüttel U14'
      );
      expect(text(teil(lumi, 'letztes'))).toContain('Sa., 07.11.2026');
      expect(text(teil(lumi, 'letztes'))).toContain(
        'Letztes Ergebnis · MTV Wasbüttel U14'
      );
      expect(teamNamen(seite)).toEqual([]);
      expect(seite.querySelector('[data-qa="ueberblick-weitere"]')).toBeNull();
    });

    it('orders the Kinder by their next Spiel, a Kind without one last', async () => {
      const gespielt = [WASBUETTEL, GIFHORN, OESINGEN].map((von) =>
        spiel(von, WASBUETTEL_U14, '2026-11-01', { status: GESPIELT_78_47 })
      );
      const data = fakeData(
        [
          saison(
            WASBUETTEL,
            gespielt[0],
            spiel(WASBUETTEL, OESINGEN, '2026-11-28')
          ),
          saison(GIFHORN, gespielt[1], spiel(GIFHORN, OESINGEN, '2026-11-14')),
          saison(OESINGEN, gespielt[2]),
        ],
        inDerSporthalle,
        OHNE_TEAMS,
        berichte({
          [gespielt[0].id]: [LUMI],
          [gespielt[1].id]: [MORVO],
          [gespielt[2].id]: [NELKA],
        })
      );

      const { seite } = await render(
        data,
        await mitKindern(
          [WASBUETTEL.id, GIFHORN.id, OESINGEN.id],
          [[NELKA], [LUMI], [MORVO]]
        )
      );

      expect(kindNamen(seite)).toEqual(['Morvo', 'Lumi', 'Nelka']);
    });

    it('says when the Kind was not on the Kader of the last Spiel', async () => {
      const davor = spiel(WASBUETTEL, GIFHORN, '2026-10-25', {
        status: GESPIELT_78_47,
      });
      const zuletzt = spiel(WASBUETTEL, OESINGEN, '2026-11-01', {
        status: GESPIELT_78_47,
      });
      const data = fakeData(
        [saison(WASBUETTEL, davor, zuletzt)],
        inDerSporthalle,
        OHNE_TEAMS,
        berichte({ [davor.id]: [LUMI], [zuletzt.id]: [MORVO] })
      );

      const { seite } = await render(
        data,
        await mitKindern([WASBUETTEL.id], [[LUMI]])
      );

      const [lumi] = kinderAbschnitte(seite);
      expect(text(teil(lumi, 'letztes'))).toContain('SV Groß Oesingen');
      expect(text(teil(lumi, 'kader'))).toBe(
        'remove_circle_outline Nicht im Kader'
      );
    });

    it('reads only the last Spielbericht where it names every Kind', async () => {
      const gespielt = ['2026-10-18', '2026-10-25', '2026-11-01'].map((datum) =>
        spiel(WASBUETTEL, GIFHORN, datum, { status: GESPIELT_78_47 })
      );
      const data = fakeData(
        [saison(WASBUETTEL, ...gespielt)],
        inDerSporthalle,
        OHNE_TEAMS,
        berichte(Object.fromEntries(gespielt.map(({ id }) => [id, [LUMI]])))
      );

      await render(data, await mitKindern([WASBUETTEL.id], [[LUMI]]));

      expect(data.gameReport.mock.calls.map(([id]) => id)).toEqual([
        gespielt[2].id,
      ]);
    });

    it("never looks into the opponent's Kader for a Kind", async () => {
      const gespielt = spiel(WASBUETTEL, GIFHORN, '2026-11-01', {
        status: GESPIELT_78_47,
      });
      const data = fakeData(
        [saison(WASBUETTEL, gespielt)],
        inDerSporthalle,
        OHNE_TEAMS,
        berichte({ [gespielt.id]: [] }, { [gespielt.id]: [LUMI] })
      );

      const { seite } = await render(
        data,
        await mitKindern([WASBUETTEL.id], [[LUMI, 'Lu']])
      );

      const [lumi] = kinderAbschnitte(seite);
      expect(text(teil(lumi, 'kind-fehlt'))).toContain(
        'In den letzten Spielberichten deiner Teams steht dieses Kind nicht.'
      );
      expect(teamNamen(seite)).toEqual(['MTV Wasbüttel']);
    });

    it('puts a Team among the others once the Kind missed its last 5 played Spiele', async () => {
      const gespielt = [
        '2026-10-04',
        '2026-10-11',
        '2026-10-18',
        '2026-10-25',
        '2026-11-01',
        '2026-11-07',
      ].map((datum) => spiel(WASBUETTEL, GIFHORN, datum, GESPIELT_AM(datum)));
      // the Kind played only in the oldest, the sixth Spiel back
      const data = fakeData(
        [saison(WASBUETTEL, ...gespielt)],
        inDerSporthalle,
        OHNE_TEAMS,
        berichte(
          Object.fromEntries(
            gespielt.map(({ id }, i) => [id, i === 0 ? [LUMI] : [MORVO]])
          )
        )
      );

      const { seite } = await render(
        data,
        await mitKindern([WASBUETTEL.id], [[LUMI]])
      );

      expect(data.gameReport).toHaveBeenCalledTimes(5);
      expect(data.gameReport).not.toHaveBeenCalledWith(
        gespielt[0].id,
        expect.anything()
      );
      expect(kindNamen(seite)).toEqual(['Mein Kind']);
      expect(teamNamen(seite)).toEqual(['MTV Wasbüttel']);
    });

    it('finds the Kind in the fifth played Spiel back', async () => {
      const gespielt = [
        '2026-10-11',
        '2026-10-18',
        '2026-10-25',
        '2026-11-01',
        '2026-11-07',
      ].map((datum) => spiel(WASBUETTEL, GIFHORN, datum, GESPIELT_AM(datum)));
      const data = fakeData(
        [saison(WASBUETTEL, ...gespielt)],
        inDerSporthalle,
        OHNE_TEAMS,
        berichte(
          Object.fromEntries(
            gespielt.map(({ id }, i) => [id, i === 0 ? [LUMI] : [MORVO]])
          )
        )
      );

      const { seite } = await render(
        data,
        await mitKindern([WASBUETTEL.id], [[LUMI]])
      );

      const [lumi] = kinderAbschnitte(seite);
      expect(text(teil(lumi, 'kind-teams'))).toBe('MTV Wasbüttel');
      // played that Spiel, but not the last one
      expect(text(teil(lumi, 'kader'))).toContain('Nicht im Kader');
    });

    it("says the Spielberichte can't be read where the search failed, and lists the Team below", async () => {
      const gespielt = spiel(WASBUETTEL, GIFHORN, '2026-11-01', {
        status: GESPIELT_78_47,
      });
      const data = fakeData(
        [saison(WASBUETTEL, gespielt)],
        inDerSporthalle,
        OHNE_TEAMS,
        async () => {
          throw new BasketballDataError('offline', 'no network');
        }
      );

      const { seite } = await render(
        data,
        await mitKindern([WASBUETTEL.id], [[LUMI, 'Lu']])
      );

      const [lumi] = kinderAbschnitte(seite);
      expect(text(teil(lumi, 'kind-fehlt'))).toBe(
        'Die Spiele deiner Teams lassen sich gerade nicht alle lesen.'
      );
      expect(teamNamen(seite)).toEqual(['MTV Wasbüttel']);
    });

    it('lists a Team among the others while its Kader is still read', async () => {
      const gespielt = spiel(WASBUETTEL, GIFHORN, '2026-11-01', {
        status: GESPIELT_78_47,
      });
      const data = fakeData(
        [saison(WASBUETTEL, gespielt)],
        inDerSporthalle,
        OHNE_TEAMS,
        () => NIE_BERICHT
      );

      const { seite } = await render(
        data,
        await mitKindern([WASBUETTEL.id], [[LUMI, 'Lu']])
      );

      const [lumi] = kinderAbschnitte(seite);
      expect(lumi.querySelector('mat-progress-bar')).not.toBeNull();
      expect(teil(lumi, 'kind-fehlt')).toBeNull();
      expect(teamNamen(seite)).toEqual(['MTV Wasbüttel']);
    });

    it("ends the search of a Team whose Saison can't be read, the Kind's card saying why", async () => {
      const gespielt = spiel(WASBUETTEL, GIFHORN, '2026-11-01', {
        status: GESPIELT_78_47,
      });
      const data = fakeData(
        [
          saison(WASBUETTEL, gespielt),
          {
            teamId: OESINGEN.id,
            fehler: new BasketballDataError('offline', ''),
          },
        ],
        inDerSporthalle,
        OHNE_TEAMS,
        berichte({ [gespielt.id]: [MORVO] })
      );

      const { seite } = await render(
        data,
        await mitKindern([WASBUETTEL.id, OESINGEN.id], [[LUMI, 'Lu']])
      );

      const [lumi] = kinderAbschnitte(seite);
      expect(lumi.querySelector('mat-progress-bar')).toBeNull();
      expect(text(teil(lumi, 'kind-fehlt'))).toBe(
        'Die Spiele deiner Teams lassen sich gerade nicht alle lesen.'
      );
      expect(eintraege(seite)).toHaveLength(2);
    });

    describe('a change to the Kinder', () => {
      const GESPIELT_SPIEL = spiel(WASBUETTEL, GIFHORN, '2026-11-01', {
        status: GESPIELT_78_47,
      });

      async function mitLumiGefunden() {
        const data = fakeData(
          [saison(WASBUETTEL, GESPIELT_SPIEL)],
          inDerSporthalle,
          OHNE_TEAMS,
          berichte({ [GESPIELT_SPIEL.id]: [LUMI, MORVO] })
        );
        const gerendert = await render(
          data,
          await mitKindern([WASBUETTEL.id], [[LUMI, 'Lu']])
        );
        return { data, ...gerendert };
      }

      function zeigtLumi(seite: HTMLElement): void {
        const [lumi] = kinderAbschnitte(seite);
        expect(text(teil(lumi, 'kind-name'))).toBe('Lu');
        expect(text(teil(lumi, 'kind-teams'))).toBe('MTV Wasbüttel');
        expect(text(teil(lumi, 'kader'))).toContain('Im Kader');
      }

      it('keeps what was found while a Kind marked anew is looked for', async () => {
        const { data, seite, auswahl, stabil } = await mitLumiGefunden();
        data.gameReport.mockImplementation(() => NIE_BERICHT);

        await auswahl.markieren(MORVO);
        await stabil();

        zeigtLumi(seite);
        expect(kindNamen(seite)).toEqual(['Lu', MEIN_KIND]);
        expect(teamNamen(seite)).toEqual([]);
      });

      it('keeps what was found where a search run again fails as a whole', async () => {
        const { data, seite, auswahl, stabil } = await mitLumiGefunden();
        // a Kader without entries breaks the search off as a whole
        data.gameReport.mockResolvedValue({
          gameId: GESPIELT_SPIEL.id,
          home: {},
          away: {},
        } as unknown as GameReport);

        await auswahl.markieren(MORVO);
        await stabil();

        zeigtLumi(seite);
        expect(teamNamen(seite)).toEqual([]);
      });

      it('reads nothing again when a Kind is unmarked', async () => {
        const { data, seite, auswahl, stabil } = await mitLumiGefunden();
        await auswahl.markieren(MORVO);
        await stabil();
        const gelesen = data.gameReport.mock.calls.length;

        await auswahl.entmarkieren(MORVO.personId);
        await stabil();

        expect(data.gameReport).toHaveBeenCalledTimes(gelesen);
        zeigtLumi(seite);
        expect(kinderAbschnitte(seite)).toHaveLength(1);
      });
    });

    it("says a Kind's Teams may be more where another Team's Spielberichte can't be read", async () => {
      const gelesen = spiel(WASBUETTEL, GIFHORN, '2026-11-01', {
        status: GESPIELT_78_47,
      });
      const fehlt = spiel(OESINGEN, GIFHORN, '2026-11-01', {
        status: GESPIELT_78_47,
      });
      const finden = berichte({ [gelesen.id]: [LUMI] });
      const data = fakeData(
        [saison(WASBUETTEL, gelesen), saison(OESINGEN, fehlt)],
        inDerSporthalle,
        OHNE_TEAMS,
        async (spielId, options) => {
          if (spielId === fehlt.id) {
            throw new BasketballDataError('unavailable', 'DBB down');
          }
          return finden(spielId, options);
        }
      );

      const { seite } = await render(
        data,
        await mitKindern([WASBUETTEL.id, OESINGEN.id], [[LUMI, 'Lu']])
      );

      const [lumi] = kinderAbschnitte(seite);
      expect(text(teil(lumi, 'kind-teams'))).toBe('MTV Wasbüttel');
      expect(text(teil(lumi, 'kind-unvollstaendig'))).toBe(VIELLEICHT_MEHR);
    });

    it("says a Kind's Teams may be more where another Team's Saison can't be read", async () => {
      const gelesen = spiel(WASBUETTEL, GIFHORN, '2026-11-01', {
        status: GESPIELT_78_47,
      });
      const data = fakeData(
        [
          saison(WASBUETTEL, gelesen),
          {
            teamId: OESINGEN.id,
            fehler: new BasketballDataError('offline', ''),
          },
        ],
        inDerSporthalle,
        OHNE_TEAMS,
        berichte({ [gelesen.id]: [LUMI] })
      );

      const { seite } = await render(
        data,
        await mitKindern([WASBUETTEL.id, OESINGEN.id], [[LUMI, 'Lu']])
      );

      expect(
        text(teil(kinderAbschnitte(seite)[0], 'kind-unvollstaendig'))
      ).toBe(VIELLEICHT_MEHR);
    });

    it('shows what falls through around the next Spiel in tip-off order', async () => {
      const gespielt = [WASBUETTEL, WASBUETTEL_U14].map((von) =>
        spiel(von, GIFHORN, '2026-11-01', { status: GESPIELT_78_47 })
      );
      const frueherAus = spiel(WASBUETTEL_U14, OESINGEN, '2026-11-14', {
        status: { kind: 'cancelled' },
      });
      const naechstes = spiel(WASBUETTEL, OESINGEN, '2026-11-21');
      const spaeterAus = spiel(WASBUETTEL_U14, OESINGEN, '2026-11-28', {
        status: { kind: 'cancelled' },
      });
      const data = fakeData(
        [
          saison(WASBUETTEL, gespielt[0], naechstes),
          saison(
            WASBUETTEL_U14,
            gespielt[1],
            frueherAus,
            spaeterAus,
            spiel(WASBUETTEL_U14, OESINGEN, '2026-12-05')
          ),
        ],
        inDerSporthalle,
        OHNE_TEAMS,
        berichte({ [gespielt[0].id]: [LUMI], [gespielt[1].id]: [LUMI] })
      );

      const { seite } = await render(
        data,
        await mitKindern([WASBUETTEL.id, WASBUETTEL_U14.id], [[LUMI]])
      );

      const teile = [
        ...kinderAbschnitte(seite)[0].querySelectorAll(
          '[data-qa="ueberblick-ausfall"], [data-qa="ueberblick-naechstes"]'
        ),
      ].map((element) => [
        element.getAttribute('data-qa'),
        text(element.querySelector('[data-qa="spiel-datum"]')),
      ]);
      expect(teile).toEqual([
        ['ueberblick-ausfall', 'Sa., 14.11.2026'],
        ['ueberblick-naechstes', 'Sa., 21.11.2026'],
        ['ueberblick-ausfall', 'Sa., 28.11.2026'],
      ]);
    });

    it('says nothing of more Teams where every Spielbericht was read', async () => {
      const gelesen = spiel(WASBUETTEL, GIFHORN, '2026-11-01', {
        status: GESPIELT_78_47,
      });
      const { seite } = await render(
        fakeData(
          [saison(WASBUETTEL, gelesen)],
          inDerSporthalle,
          OHNE_TEAMS,
          berichte({ [gelesen.id]: [LUMI] })
        ),
        await mitKindern([WASBUETTEL.id], [[LUMI, 'Lu']])
      );

      expect(
        teil(kinderAbschnitte(seite)[0], 'kind-unvollstaendig')
      ).toBeNull();
    });

    it('reads no Spielbericht while no Kind is marked', async () => {
      const data = fakeData([
        saison(
          WASBUETTEL,
          spiel(WASBUETTEL, GIFHORN, '2026-11-01', { status: GESPIELT_78_47 })
        ),
      ]);

      await render(data, [WASBUETTEL.id]);

      expect(data.gameReport).not.toHaveBeenCalled();
    });

    it('starts the search once a Kind is marked, and groups the Team under it', async () => {
      const gespielt = spiel(WASBUETTEL, GIFHORN, '2026-11-01', {
        status: GESPIELT_78_47,
      });
      const data = fakeData(
        [saison(WASBUETTEL, gespielt)],
        inDerSporthalle,
        OHNE_TEAMS,
        berichte({ [gespielt.id]: [LUMI] })
      );
      const { seite, auswahl, stabil } = await render(data, [WASBUETTEL.id]);

      await auswahl.markieren(LUMI, 'Lu');
      await stabil();

      expect(kindNamen(seite)).toEqual(['Lu']);
      expect(teamNamen(seite)).toEqual([]);
    });

    describe('while no Kind is marked', () => {
      function hinweis(seite: HTMLElement): string | undefined {
        return text(seite.querySelector('[data-qa="ueberblick-hinweis"]'));
      }

      it('explains that a Kind can be marked after its first Spiel, while no Team has played', async () => {
        const { seite } = await render(
          fakeData([
            saison(WASBUETTEL, spiel(WASBUETTEL, GIFHORN, '2026-11-14')),
          ]),
          [WASBUETTEL.id]
        );

        expect(hinweis(seite)).toBe(
          'Dein Kind kannst du markieren, sobald es nach seinem ersten Spiel in einem Spielbericht steht. Öffne dann das Spiel und markiere es im Kader.'
        );
        expect(teamNamen(seite)).toEqual(['MTV Wasbüttel']);
      });

      it('asks to open a played Spiel once a Team has played', async () => {
        const { seite } = await render(
          fakeData([
            saison(WASBUETTEL, spiel(WASBUETTEL, GIFHORN, '2026-11-14')),
            saison(
              GIFHORN,
              spiel(GIFHORN, OESINGEN, '2026-11-01', { status: GESPIELT_78_47 })
            ),
          ]),
          [WASBUETTEL.id, GIFHORN.id]
        );

        expect(hinweis(seite)).toBe(
          'Öffne ein gespieltes Spiel, um dein Kind im Kader zu markieren, sobald sein Spielbericht da ist.'
        );
      });

      it('says neither while no Team is followed', async () => {
        const { seite } = await render(fakeData([]), []);
        expect(hinweis(seite)).toBeUndefined();
      });

      it('says neither once a Kind is marked', async () => {
        const { seite } = await render(
          fakeData([
            saison(WASBUETTEL, spiel(WASBUETTEL, GIFHORN, '2026-11-14')),
          ]),
          await mitKindern([WASBUETTEL.id], [[LUMI]])
        );

        expect(hinweis(seite)).toBeUndefined();
      });
    });
  });
});
