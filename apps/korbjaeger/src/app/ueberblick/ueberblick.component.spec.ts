import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  BasketballDataError,
  type Halle,
  type Liga,
  type SpielDetails,
  type Spiel,
  type SpielPartei,
  type Team,
  type TeamId,
  type TeamSaison,
  type VereinsTeams,
} from '@wolsok/feat-shared-basketball-data';
import { AUSWAHL, type Auswahl } from '../auswahl/auswahl';
import { LokaleAuswahl } from '../auswahl/lokale-auswahl';
import {
  BASKETBALL_DATA,
  type KorbjaegerData,
} from '../basketball-data/basketball-data.provider';
import { HEUTE } from '../heute';
import { UeberblickComponent } from './ueberblick.component';

/** The day the specs run on. */
const HEUTE_IM_SPEC = '2026-11-08';

const VORRUNDE: Liga = {
  id: 54862,
  name: 'U12 Vorrunde Nord',
  verband: { id: 7, name: 'Niedersachsen' },
  altersklasse: 'U12',
  geschlecht: 'mix',
  spielklasse: 'Kreisliga',
};

function team(id: TeamId, name: string): Team {
  return { id, name, vereinId: id };
}

const WASBUETTEL = team(313036, 'MTV Wasbüttel');
const WASBUETTEL_U14 = team(313040, 'MTV Wasbüttel U14');
const GIFHORN = team(201500, 'MTV Gifhorn');
const OESINGEN = team(201765, 'SV Groß Oesingen');

function partei(team: Team): SpielPartei {
  return { art: 'team', team };
}

const GESPIELT_78_47: Spiel['status'] = {
  art: 'gespielt',
  ergebnis: { heim: 78, gast: 47 },
  bestaetigt: true,
};

let naechsteSpielId = 1;

/** A Spiel of `heim` at home against `gast`. */
function spiel(
  heim: Team,
  gast: Team,
  datum: string,
  overrides: Partial<Spiel> = {}
): Spiel {
  return {
    id: naechsteSpielId++,
    ligaId: VORRUNDE.id,
    spieltag: 1,
    datum,
    uhrzeit: '10:00',
    heim: partei(heim),
    gast: partei(gast),
    status: { art: 'geplant' },
    ...overrides,
  };
}

function saison(von: Team, ...spiele: Spiel[]): TeamSaison {
  return {
    team: von,
    verein: { id: von.vereinId, name: von.name },
    ligen: [VORRUNDE],
    spiele,
  };
}

type TeamSpieleRead = KorbjaegerData['teamSpiele'];
type SpielRead = KorbjaegerData['spiel'];
type VereinsTeamsRead = KorbjaegerData['vereinsTeams'];

/** A Verein whose recent Spiele show no Team. */
const OHNE_TEAMS: VereinsTeamsRead = async (vereinId) => ({
  verein: { id: vereinId, name: 'Verein' },
  teams: [],
});

/** Where every Spiel of the specs is played, unless one says otherwise. */
const SPORTHALLE: Halle = {
  name: 'Sporthalle am Wasserturm',
  strasse: 'Turmweg 1',
  plz: '38518',
  ort: 'Gifhorn',
};

/** Every Spiel's details, in the Sporthalle. */
const inDerSporthalle: SpielRead = async (spielId) => ({
  spiel: spiel(WASBUETTEL, GIFHORN, '2026-11-14', { id: spielId }),
  liga: VORRUNDE,
  halle: SPORTHALLE,
  viertel: [],
  verlaengerungen: [],
});

/**
 * `KorbjaegerData` answering each Team's Spiele from `saisons`, and every
 * Spiel's details by `details`.
 */
function fakeData(
  saisons: readonly (TeamSaison | { teamId: TeamId; fehler: Error })[],
  details: SpielRead = inDerSporthalle,
  vereinsTeams: VereinsTeamsRead = OHNE_TEAMS
): {
  readonly teamSpiele: ReturnType<typeof vi.fn<TeamSpieleRead>>;
  readonly spiel: ReturnType<typeof vi.fn<SpielRead>>;
  readonly vereinsTeams: ReturnType<typeof vi.fn<VereinsTeamsRead>>;
} {
  return {
    spiel: vi.fn<SpielRead>(details),
    vereinsTeams: vi.fn<VereinsTeamsRead>(vereinsTeams),
    teamSpiele: vi.fn<TeamSpieleRead>(async (teamId) => {
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
  data: Pick<KorbjaegerData, 'teamSpiele' | 'spiel' | 'vereinsTeams'>,
  gefolgt: readonly TeamId[] | Auswahl
): Promise<{
  readonly seite: HTMLElement;
  readonly auswahl: Auswahl;
  /** Waits for the reads that settle and the page. */
  readonly stabil: () => Promise<void>;
}> {
  const auswahl = 'teams' in gefolgt ? gefolgt : await folgend(gefolgt);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: BASKETBALL_DATA, useValue: data },
      { provide: HEUTE, useValue: signal(HEUTE_IM_SPEC) },
      { provide: AUSWAHL, useValue: auswahl },
    ],
  });
  const fixture = TestBed.createComponent(UeberblickComponent);
  // not whenStable: it waits for every read, and some never settle here
  const stabil = async (): Promise<void> => {
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  };
  await stabil();
  return { seite: fixture.nativeElement as HTMLElement, auswahl, stabil };
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

    const { seite } = await render(data, {
      teams: signal(undefined),
      folgen: () => Promise.resolve(),
      entfolgen: () => Promise.resolve(),
    });

    expect(seite.querySelector('[data-qa="ueberblick-leer"]')).toBeNull();
    expect(eintraege(seite)).toEqual([]);
    expect(data.teamSpiele).not.toHaveBeenCalled();
  });

  it('invites to follow a first Team while none is followed', async () => {
    const data = fakeData([]);

    const { seite } = await render(data, []);

    expect(eintraege(seite)).toEqual([]);
    expect(text(seite.querySelector('[data-qa="ueberblick-leer"]'))).toContain(
      'Du folgst noch keinem Team.'
    );
    expect(data.teamSpiele).not.toHaveBeenCalled();
  });

  it('offers to set up a first Team while none is followed', async () => {
    const { seite } = await render(fakeData([]), []);

    const link = seite.querySelector<HTMLAnchorElement>(
      '[data-qa="ueberblick-leer"] a'
    );
    expect(text(link)).toBe('Team einrichten');
    expect(link?.getAttribute('href')).toBe('/team-einrichten');
  });

  it('offers no set-up once a Team is followed', async () => {
    const { seite } = await render(fakeData([saison(WASBUETTEL)]), [
      WASBUETTEL.id,
    ]);

    expect(seite.querySelector('a[href="/team-einrichten"]')).toBeNull();
  });

  it('shows the next Spiel with day, time, home or away and opponent', async () => {
    const { seite } = await render(
      fakeData([
        saison(
          WASBUETTEL,
          spiel(GIFHORN, WASBUETTEL, '2026-11-14', { uhrzeit: '15:30' })
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
          spiel(WASBUETTEL, GIFHORN, '2026-11-14', { uhrzeit: '16:00' })
        ),
        saison(
          WASBUETTEL_U14,
          spiel(WASBUETTEL_U14, OESINGEN, '2026-11-14', { uhrzeit: '11:00' })
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
            status: { art: 'abgesagt' },
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
              art: 'kampflos',
              verzichtet: ['gast'],
              ergebnis: { heim: 20, gast: 0 },
            },
          }),
          spiel(OESINGEN, WASBUETTEL, '2026-11-14', {
            status: { art: 'kampflos', verzichtet: ['heim'] },
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

      expect(data.spiel.mock.calls.map(([spielId]) => spielId)).toEqual(
        expect.arrayContaining([naechstesWasbuettel.id, naechstesGifhorn.id])
      );
      expect(data.spiel).toHaveBeenCalledTimes(2);
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
    const NIE: Promise<TeamSaison> = new Promise(() => undefined);
    const NIE_DETAILS: Promise<SpielDetails> = new Promise(() => undefined);

    it('shows a Team while another still loads', async () => {
      const { seite } = await render(
        {
          spiel: inDerSporthalle,
          vereinsTeams: OHNE_TEAMS,
          teamSpiele: async (teamId) =>
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
      expect(data.teamSpiele.mock.calls.map(([teamId]) => teamId)).toEqual([
        WASBUETTEL.id,
        OESINGEN.id,
        GIFHORN.id,
      ]);
    });

    it('cancels the read of a Team unfollowed while it loads', async () => {
      const data = fakeData([]);
      data.teamSpiele.mockImplementation(() => NIE);
      const { auswahl, stabil } = await render(data, [GIFHORN.id]);
      const lesung = data.teamSpiele.mock.calls[0][1]?.signal;

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
      const lesung = data.spiel.mock.calls[0][1]?.signal;
      expect(lesung?.aborted).toBe(false);

      await auswahl.entfolgen(GIFHORN.id);
      await stabil();

      expect(lesung?.aborted).toBe(true);
    });

    it("reads no Halle before a Team's next Spiel is known", async () => {
      const data = fakeData([]);
      data.teamSpiele.mockImplementation(() => NIE);

      await render(data, [GIFHORN.id]);

      expect(data.spiel).not.toHaveBeenCalled();
    });

    it('puts a Team in its place once it has loaded', async () => {
      let gifhornLaden: (saison: TeamSaison) => void = () => undefined;
      const { seite, stabil } = await render(
        {
          spiel: inDerSporthalle,
          vereinsTeams: OHNE_TEAMS,
          teamSpiele: (teamId) =>
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

    it('removes a Team whose read fails from Meine Teams on request', async () => {
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
      const entfernen = gifhorn.querySelector<HTMLButtonElement>(
        '[data-qa="ueberblick-entfernen"]'
      );
      expect(text(entfernen)).toBe('Entfernen');

      entfernen?.click();
      await stabil();

      expect(auswahl.teams()).toEqual([WASBUETTEL.id]);
      expect(teamNamen(seite)).toEqual(['MTV Wasbüttel']);
    });

    it('offers no removal for a Team that loaded', async () => {
      const { seite } = await render(fakeData([saison(WASBUETTEL)]), [
        WASBUETTEL.id,
      ]);

      expect(
        eintraege(seite)[0].querySelector('[data-qa="ueberblick-entfernen"]')
      ).toBeNull();
    });
  });

  describe('the end of the Saison', () => {
    /** Wasbüttel's Verein: the Team itself and its U14. */
    const WASBUETTELS_VEREIN: VereinsTeams = {
      verein: { id: WASBUETTEL.vereinId, name: 'MTV Wasbüttel' },
      teams: [
        { team: WASBUETTEL, ligen: [VORRUNDE] },
        {
          team: WASBUETTEL_U14,
          ligen: [{ ...VORRUNDE, id: 54900, name: 'U14 Regionsliga' }],
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

    it("says a Team's Saison is over and suggests its Verein's current Teams", async () => {
      // more than two weeks before 8 November
      const data = mitLetztemSpielAm('2026-10-17');

      const { seite, stabil } = await render(data, [WASBUETTEL.id]);
      // the Verein is read once its card is there
      await stabil();

      const hinweis = teil(eintraege(seite)[0], 'saison-beendet');
      expect(text(hinweis)).toContain('Saison vorbei');
      expect(data.vereinsTeams).toHaveBeenCalledWith(WASBUETTEL.vereinId, {
        signal: expect.any(AbortSignal),
      });
      expect(
        [
          ...(hinweis?.querySelectorAll('[data-qa="vereins-team-name"]') ?? []),
        ].map((name) => text(name))
      ).toEqual(['MTV Wasbüttel U14']);
      expect(text(teil(eintraege(seite)[0], 'letztes'))).toContain('78:47');
    });

    it('follows a suggested Team from the card', async () => {
      const { seite, auswahl, stabil } = await render(
        mitLetztemSpielAm('2026-10-17'),
        [WASBUETTEL.id]
      );
      await stabil();

      teil(eintraege(seite)[0], 'saison-beendet')
        ?.querySelector<HTMLButtonElement>('button[aria-pressed]')
        ?.click();
      await stabil();

      expect(auswahl.teams()).toEqual([WASBUETTEL.id, WASBUETTEL_U14.id]);
    });

    it('says nothing and reads no Verein exactly two weeks after the last Spiel', async () => {
      const data = mitLetztemSpielAm('2026-10-25');

      const { seite } = await render(data, [WASBUETTEL.id]);

      expect(teil(eintraege(seite)[0], 'saison-beendet')).toBeNull();
      expect(data.vereinsTeams).not.toHaveBeenCalled();
    });

    it('says nothing for a Team without Spiele', async () => {
      const data = fakeData([saison(WASBUETTEL)]);

      const { seite } = await render(data, [WASBUETTEL.id]);

      expect(teil(eintraege(seite)[0], 'saison-beendet')).toBeNull();
      expect(data.vereinsTeams).not.toHaveBeenCalled();
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
});
