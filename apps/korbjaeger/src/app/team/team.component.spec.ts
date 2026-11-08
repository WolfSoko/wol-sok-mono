import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  BasketballDataError,
  type Halle,
  type Liga,
  type Spiel,
  type SpielPartei,
  type Tabelle,
  type Team,
  type TeamSaison,
} from '@wolsok/feat-shared-basketball-data';
import {
  BASKETBALL_DATA,
  type KorbjaegerData,
} from '../basketball-data/basketball-data.provider';
import { AUSWAHL } from '../auswahl/auswahl';
import { LokaleAuswahl } from '../auswahl/lokale-auswahl';
import { HEUTE } from '../heute';
import { TeamComponent } from './team.component';

const UNSER_TEAM: Team = { id: 313036, name: 'MTV Wasbüttel', vereinId: 1837 };

function liga(id: number, name: string): Liga {
  return {
    id,
    name,
    verband: { id: 7, name: 'Niedersachsen' },
    altersklasse: 'U12',
    geschlecht: 'mix',
    spielklasse: 'Kreisliga',
  };
}

const VORRUNDE = liga(54862, 'U12 Vorrunde Nord');
const TESTSPIELE = liga(54689, 'Testspiele Braunschweig u12');

function gegner(id: number, name: string): SpielPartei {
  return { art: 'team', team: { id, name, vereinId: id } };
}

const UNS: SpielPartei = { art: 'team', team: UNSER_TEAM };

function spiel(overrides: Partial<Spiel> & Pick<Spiel, 'id' | 'datum'>): Spiel {
  return {
    ligaId: VORRUNDE.id,
    spieltag: 1,
    uhrzeit: '10:00',
    heim: UNS,
    gast: gegner(201500, 'MTV Gifhorn'),
    status: { art: 'geplant' },
    ...overrides,
  };
}

function tabellenZeile(rang: number, team: Team): Tabelle['zeilen'][number] {
  return {
    rang,
    partei: { art: 'team', team },
    spiele: 2,
    siege: 2 - rang + 1,
    niederlagen: rang - 1,
    punkte: 2 * (2 - rang + 1),
    koerbe: 100,
    gegenkoerbe: 90,
    korbdifferenz: 10,
  };
}

function saison(spiele: readonly Spiel[]): TeamSaison {
  return {
    team: UNSER_TEAM,
    verein: { id: 1837, name: 'MTV Wasbüttel' },
    ligen: [TESTSPIELE, VORRUNDE],
    spiele,
  };
}

type TeamSpieleRead = KorbjaegerData['teamSpiele'];
type TabelleRead = KorbjaegerData['tabelle'];
type SpielRead = KorbjaegerData['spiel'];

/** The day the specs run on: after the last Spiel of the fixtures below. */
const HEUTE_IM_SPEC = '2026-11-08';

/** An empty Tabelle of Liga `ligaId`. */
const keineZeilen: TabelleRead = async (ligaId) => ({
  liga: [TESTSPIELE, VORRUNDE].find(({ id }) => id === ligaId) ?? VORRUNDE,
  zeilen: [],
});

const SCHULSPORTHALLE: Halle = {
  name: 'Schulsporthalle',
  strasse: 'Schulstr. 12',
  plz: '38553',
  ort: 'Wasbüttel',
};

/** A Spiel's details, played in the Schulsporthalle. */
const inDerSchulsporthalle: SpielRead = async (spielId) => ({
  spiel: spiel({ id: spielId, datum: '2026-11-21' }),
  liga: VORRUNDE,
  halle: SCHULSPORTHALLE,
  viertel: [],
  verlaengerungen: [],
});

/**
 * `KorbjaegerData` answering `teamSpiele` with `read`, Tabellen empty,
 * every Spiel in the Schulsporthalle.
 */
function fakeData(
  read: TeamSpieleRead,
  tabelle: TabelleRead = keineZeilen,
  details: SpielRead = inDerSchulsporthalle
): {
  readonly teamSpiele: ReturnType<typeof vi.fn<TeamSpieleRead>>;
  readonly tabelle: ReturnType<typeof vi.fn<TabelleRead>>;
  readonly spiel: ReturnType<typeof vi.fn<SpielRead>>;
} {
  return {
    teamSpiele: vi.fn<TeamSpieleRead>(read),
    tabelle: vi.fn<TabelleRead>(tabelle),
    spiel: vi.fn<SpielRead>(details),
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
    // in memory: nothing reaches the device's storage
    { provide: AUSWAHL, useFactory: () => new LokaleAuswahl(undefined) },
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
  it("reads the Team of the page's id", async () => {
    const data = fakeData(async () => saison([]));

    await render(data, '313036');

    expect(data.teamSpiele).toHaveBeenCalledWith(313036, {
      signal: expect.any(AbortSignal),
    });
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
          spiel({ id: 1, datum: '2026-08-29', ligaId: TESTSPIELE.id }),
          spiel({ id: 2, datum: '2026-09-20', uhrzeit: '15:00' }),
          spiel({ id: 3, datum: '2026-09-20', uhrzeit: '09:00' }),
          spiel({ id: 4, datum: '2026-09-12' }),
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
        saison([spiel({ id: 1, datum: '2026-09-12', uhrzeit: undefined })])
      )
    );

    expect(feld(spielZeilen(page)[0], 'uhrzeit')).toBeUndefined();
  });

  it('tells home from away and names the opponent', async () => {
    const page = await render(
      fakeData(async () =>
        saison([
          spiel({ id: 1, datum: '2026-09-12', gast: gegner(2, 'MTV Gifhorn') }),
          spiel({
            id: 2,
            datum: '2026-09-20',
            heim: gegner(3, 'SV Groß Oesingen'),
            gast: UNS,
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
            datum: '2026-09-12',
            heim: gegner(2, 'MTV Gifhorn'),
            gast: gegner(3, 'SV Groß Oesingen'),
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
            datum: '2026-12-05',
            gast: { art: 'offen', bezeichnung: 'Nord 1. Platz' },
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
            datum: '2026-09-12',
            heim: gegner(3, 'TuS Müden-Dieckhorst'),
            gast: UNS,
            status: {
              art: 'gespielt',
              ergebnis: { heim: 46, gast: 99 },
              bestaetigt: true,
            },
          }),
          spiel({ id: 2, datum: '2026-11-21' }),
        ])
      )
    );

    const [gespielt, geplant] = spielZeilen(page);
    expect(feld(gespielt, 'ergebnis')).toBe('46:99');
    expect(feld(geplant, 'ergebnis')).toBeUndefined();
  });

  it('marks a cancelled Spiel', async () => {
    const page = await render(
      fakeData(async () =>
        saison([
          spiel({ id: 1, datum: '2026-10-03', status: { art: 'abgesagt' } }),
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
            datum: '2026-10-03',
            status: {
              art: 'kampflos',
              verzichtet: ['gast'],
              ergebnis: { heim: 20, gast: 0 },
            },
          }),
          spiel({
            id: 2,
            datum: '2026-10-10',
            status: { art: 'kampflos', verzichtet: [] },
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
          spiel({ id: 2861436, datum: '2026-09-20' }),
          spiel({ id: 2861439, datum: '2026-09-25' }),
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
        datum: '2026-10-03',
        status: {
          art: 'gespielt',
          ergebnis: { heim: 78, gast: 47 },
          bestaetigt: true,
        },
      }),
      spiel({ id: 2, datum: '2026-11-21', uhrzeit: '11:00' }),
      spiel({ id: 3, datum: '2026-11-28' }),
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
      expect(block?.querySelector('a[href="/spiel/2"]')?.textContent).toContain(
        'MTV Gifhorn'
      );
    });

    it("reads only the next Spiel's Halle", async () => {
      const data = fakeData(async () => MIT_NAECHSTEM);

      await render(data);

      expect(data.spiel.mock.calls.map(([spielId]) => spielId)).toEqual([2]);
    });

    it('shows none and reads no Halle once every Spiel is played', async () => {
      const data = fakeData(async () => saison([MIT_NAECHSTEM.spiele[0]]));

      const page = await render(data);

      expect(naechstes(page)).toBeNull();
      expect(data.spiel).not.toHaveBeenCalled();
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

    expect(page.querySelector('button[aria-pressed]')?.textContent).toContain(
      'Team folgen'
    );
  });

  it('offers no Team to follow for an id the DBB does not know', async () => {
    const page = await render(
      fakeData(async () => {
        throw new BasketballDataError('not-found', 'DBB: nope');
      })
    );

    expect(page.querySelector('button[aria-pressed]')).toBeNull();
  });

  it('offers to unfollow a followed Team whose read fails', async () => {
    const auswahl = new LokaleAuswahl(undefined);
    await auswahl.folgen(313036);
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
      'button[aria-pressed]'
    ) as HTMLButtonElement | null;
    expect(knopf?.getAttribute('aria-pressed')).toBe('true');

    knopf?.click();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();

    expect(auswahl.teams()).toEqual([]);
  });

  it('says so when the Team has no Spiele', async () => {
    const page = await render(fakeData(async () => saison([])));

    expect(page.textContent).toContain('Noch keine Spiele in dieser Saison.');
  });

  it('shows that it is loading', async () => {
    TestBed.configureTestingModule({
      providers: providers(
        fakeData(() => new Promise<TeamSaison>(() => undefined))
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
      expect(data.teamSpiele).not.toHaveBeenCalled();
    }
  );

  it('cancels the read of a Team the page has left', async () => {
    const data = fakeData(() => new Promise<TeamSaison>(() => undefined));
    TestBed.configureTestingModule({ providers: providers(data) });
    const fixture = TestBed.createComponent(TeamComponent);
    fixture.componentRef.setInput('teamId', '313036');
    fixture.detectChanges();
    const erster = data.teamSpiele.mock.calls[0][1]?.signal;

    fixture.componentRef.setInput('teamId', '201500');
    fixture.detectChanges();

    expect(data.teamSpiele).toHaveBeenLastCalledWith(201500, {
      signal: expect.any(AbortSignal),
    });
    expect(erster?.aborted).toBe(true);
  });
  describe('Tabellen', () => {
    const ZWEI_LIGEN = saison([
      spiel({ id: 1, datum: '2026-08-29', ligaId: TESTSPIELE.id }),
      spiel({ id: 2, datum: '2026-09-12' }),
      spiel({ id: 3, datum: '2026-11-08' }),
    ]);

    function tabellen(page: HTMLElement): HTMLElement[] {
      return [...page.querySelectorAll<HTMLElement>('[data-qa="tabelle"]')];
    }

    function ueberschrift(tabelle: HTMLElement): string | undefined {
      return tabelle.querySelector('h3')?.textContent?.trim();
    }

    const VORRUNDE_TABELLE: Tabelle = {
      liga: VORRUNDE,
      zeilen: [
        tabellenZeile(1, { id: 201500, name: 'MTV Gifhorn', vereinId: 201500 }),
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
      expect(data.tabelle.mock.calls.map(([ligaId]) => ligaId)).toEqual([
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
              spiel({ id: 1, datum: '2026-08-29', ligaId: TESTSPIELE.id }),
              spiel({ id: 2, datum: '2026-11-08' }),
              spiel({ id: 3, datum: '2026-11-21', ligaId: TESTSPIELE.id }),
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
              : { liga: TESTSPIELE, zeilen: [] }
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
      expect(data.tabelle).not.toHaveBeenCalled();
    });
  });
});
