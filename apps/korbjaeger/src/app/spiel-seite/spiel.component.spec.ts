import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { provideRouter } from '@angular/router';
import {
  BasketballDataError,
  type Halle,
  type Kader,
  type SpielDetails,
  type Spielbericht,
  type Spielerwerte,
} from '@wolsok/feat-shared-basketball-data';
import { AUSWAHL, type Auswahl } from '../auswahl/auswahl';
import type { Kind } from '../auswahl/kind';
import { LokaleAuswahl } from '../auswahl/lokale-auswahl';
import {
  BASKETBALL_DATA,
  type KorbjaegerData,
} from '../basketball-data/basketball-data.provider';
import type { KorbReadOptions } from '../basketball-data/lesung';
import type { Stand } from '../basketball-data/stand';
import { JETZT } from '../jetzt';
import { SpielComponent } from './spiel.component';

/** Noon on the day of the Spiel, in Germany. */
const JETZT_IM_SPEC = Date.parse('2026-11-08T12:00:00+01:00');

const HALLE: Halle = {
  name: 'Schulsporthalle',
  strasse: 'Schulstr. 12',
  plz: '38553',
  ort: 'Wasbüttel',
};

const GESPIELT: SpielDetails = {
  spiel: {
    id: 2861436,
    ligaId: 54862,
    spieltag: 3,
    datum: '2026-09-20',
    uhrzeit: '09:00',
    heim: {
      art: 'team',
      team: { id: 313036, name: 'MTV Wasbüttel', vereinId: 1837 },
    },
    gast: {
      art: 'team',
      team: { id: 201500, name: 'MTV Gifhorn', vereinId: 201500 },
    },
    status: {
      art: 'gespielt',
      ergebnis: { heim: 78, gast: 47 },
      bestaetigt: true,
    },
  },
  liga: {
    id: 54862,
    name: 'Regionsvorrunde Nord Braunschweig mu12',
    verband: { id: 7, name: 'Niedersachsen' },
    altersklasse: 'U12',
    geschlecht: 'mix',
    spielklasse: 'Regionsliga',
  },
  halle: HALLE,
  viertel: [
    { heim: 20, gast: 10 },
    { heim: 18, gast: 12 },
    { heim: 22, gast: 9 },
    { heim: 18, gast: 16 },
  ],
  verlaengerungen: [],
};

function werte(punkte: number, fouls = 2): Spielerwerte {
  return {
    punkte,
    zweier: 4,
    dreier: 1,
    freiwuerfe: { getroffen: 3, versucht: 5 },
    fouls,
  };
}

const MIT_WERTEN: Kader = {
  spielerwerteErfasst: true,
  eintraege: [
    {
      art: 'benannt',
      personId: 91692638,
      vorname: 'Ilvio',
      nachname: 'Mistelgrund',
      trikotnummer: '7',
      spielerwerte: werte(14),
    },
    { art: 'anonym', spielerwerte: werte(10, 4) },
  ],
};

const OHNE_WERTE: Kader = {
  spielerwerteErfasst: false,
  eintraege: [
    {
      art: 'benannt',
      personId: 92256481,
      vorname: 'Delon',
      nachname: 'Nesselbach',
      trikotnummer: '30',
    },
    { art: 'anonym' },
  ],
};

function bericht(heim: Kader, gast: Kader): Spielbericht {
  return { spielId: 2861436, heim, gast };
}

type SpielRead = KorbjaegerData['spiel'];
type BerichtRead = KorbjaegerData['spielbericht'];

function fakeData(
  spiel: SpielRead,
  spielbericht: BerichtRead
): {
  readonly spiel: ReturnType<typeof vi.fn<SpielRead>>;
  readonly spielbericht: ReturnType<typeof vi.fn<BerichtRead>>;
} {
  return {
    spiel: vi.fn<SpielRead>(spiel),
    spielbericht: vi.fn<BerichtRead>(spielbericht),
  };
}

const NIE = new Promise<never>(() => undefined);

async function render(
  data: ReturnType<typeof fakeData>,
  spielId = '2861436'
): Promise<HTMLElement> {
  return (await renderMit(data, new LokaleAuswahl(undefined), spielId)).seite;
}

/** Renders the page of `spielId` on `data` with `auswahl`. */
async function renderMit(
  data: ReturnType<typeof fakeData>,
  auswahl: Auswahl,
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
      { provide: JETZT, useValue: signal(JETZT_IM_SPEC) },
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
    const VOR_EINER_STUNDE: Stand = {
      gespeichertAm: JETZT_IM_SPEC - 60 * 60_000,
      grund: 'unavailable',
    };

    it('labels the Spiel with the age of its last good data', async () => {
      const page = await render(
        fakeData(
          async (_spiel, options?: KorbReadOptions) => {
            options?.lesung?.ersetzt(VOR_EINER_STUNDE);
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

      expect(page.querySelector('[data-qa="stand"]')).toBeNull();
    });
  });

  it("reads the Spiel and its Spielbericht of the page's id", async () => {
    const data = fakeData(
      async () => GESPIELT,
      async () => undefined
    );

    await render(data);

    expect(data.spiel).toHaveBeenCalledWith(
      2861436,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(data.spielbericht).toHaveBeenCalledWith(
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

    expect(data.spiel).toHaveBeenLastCalledWith(
      2911141,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(data.spielbericht).toHaveBeenLastCalledWith(
      2911141,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(teil(seite, 'spiel-ergebnis')).toBeNull();
    expect(teil(seite, 'halle')).toBeNull();
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
            spiel: {
              ...GESPIELT.spiel,
              gast: { art: 'offen', bezeichnung: 'Nord 1. Platz' },
              status: { art: 'geplant' },
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

    it.each<[string, SpielDetails['spiel']['status']]>([
      ['planned', { art: 'geplant' }],
      ['cancelled', { art: 'abgesagt' }],
      ['forfeited without a result', { art: 'kampflos', verzichtet: [] }],
    ])(
      'shows no final score for quarters of a Spiel %s',
      async (_case, status) => {
        const seite = await render(
          fakeData(
            async () => ({
              ...GESPIELT,
              spiel: { ...GESPIELT.spiel, status },
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
            verlaengerungen: [{ heim: 6, gast: 4 }],
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
          async () => ({ ...GESPIELT, viertel: [] }),
          async () => undefined
        )
      );

      expect(teil(seite, 'viertel')).toBeNull();
      expect(text(teil(seite, 'spiel-ergebnis'))).toBe('78:47');
    });

    it.each([
      [
        'a Spiel without a result yet, planned or not entered',
        { art: 'geplant' },
        'Noch kein Ergebnis',
      ],
      ['a cancelled Spiel', { art: 'abgesagt' }, 'abgesagt'],
      [
        'a forfeited Spiel, with who gave up',
        { art: 'kampflos', verzichtet: ['gast'] },
        'kampflos · MTV Gifhorn hat verzichtet',
      ],
      [
        'a result not confirmed yet',
        {
          art: 'gespielt',
          ergebnis: { heim: 78, gast: 47 },
          bestaetigt: false,
        },
        'Ergebnis noch nicht bestätigt',
      ],
    ] as const)('shows %s', async (_case, status, anzeige) => {
      const seite = await render(
        fakeData(
          async () => ({
            ...GESPIELT,
            spiel: { ...GESPIELT.spiel, status },
            viertel: [],
          }),
          async () => undefined
        )
      );

      expect(text(teil(seite, 'spiel-status'))).toBe(anzeige);
    });

    it('shows no status line for a confirmed result', async () => {
      const seite = await render(
        fakeData(
          async () => GESPIELT,
          async () => undefined
        )
      );

      expect(teil(seite, 'spiel-status')).toBeNull();
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

      const halle = teil(seite, 'halle');
      expect(text(teil(halle ?? seite, 'halle-name'))).toBe('Schulsporthalle');
      expect(text(teil(halle ?? seite, 'halle-adresse'))).toBe(
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
      const { halle: _keine, ...ohneHalle } = GESPIELT;
      const seite = await render(
        fakeData(
          async () => ohneHalle,
          async () => undefined
        )
      );

      expect(text(teil(seite, 'halle'))).toBe(
        'Die Halle steht noch nicht fest.'
      );
      expect(teil(seite, 'halle')?.querySelector('a')).toBeNull();
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
        'Freiwürfe getroffen von versucht',
        'Fouls',
      ]);
      expect(zellen(heim, 'kader-zeile')).toEqual([
        ['7', 'Ilvio Mistelgrund', '14', '5', '3/5', '2'],
        ['', 'Anonymer Spieler', '10', '5', '3/5', '4'],
      ]);
      expect(teil(heim, 'kader-ohne-werte')).toBeNull();
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
      const ohneNummern: Kader = {
        spielerwerteErfasst: true,
        eintraege: [{ art: 'anonym', spielerwerte: werte(10) }],
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
        ['Anonymer Spieler', '10', '5', '3/5', '2'],
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
      expect(text(teil(seite, 'spielbericht-fehlt'))).toMatch(
        /noch kein Spielbericht/i
      );
    });

    it('says a cancelled Spiel has no Spielbericht to wait for', async () => {
      const seite = await render(
        fakeData(
          async () => ({
            ...GESPIELT,
            spiel: { ...GESPIELT.spiel, status: { art: 'abgesagt' } },
          }),
          async () => undefined
        )
      );

      expect(text(teil(seite, 'spielbericht-fehlt'))).toBe(
        'Das Spiel fällt aus, einen Spielbericht gibt es nicht.'
      );
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
      kinder: readonly Kind[] = []
    ): Promise<{
      readonly seite: HTMLElement;
      readonly auswahl: LokaleAuswahl;
      readonly stabil: () => Promise<void>;
    }> {
      const auswahl = new LokaleAuswahl(undefined);
      for (const team of teams) {
        await auswahl.folgen(team);
      }
      for (const { personId, spitzname } of kinder) {
        await auswahl.markieren({ art: 'benannt', personId }, spitzname);
      }
      const gerendert = await renderMit(
        fakeData(
          async () => GESPIELT,
          async () => bericht(MIT_WERTEN, OHNE_WERTE)
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

      expect(auswahl.kinder()).toEqual([
        { personId: ILVIO, spitzname: 'Ilvi' },
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

      expect(auswahl.kinder()).toEqual([{ personId: ILVIO }]);
      const zeile = zeileVon(kaderVon(seite, 'MTV Wasbüttel'), 'Ilvio');
      expect(teil(zeile, 'kader-spitzname')).toBeNull();
    });

    it('marks nobody where the dialog is cancelled', async () => {
      const { seite, auswahl, stabil } = await mitAuswahl([WASBUETTEL]);

      markierKnoepfe(kaderVon(seite, 'MTV Wasbüttel'))[0].click();
      await stabil();
      knopf(dialog(), 'Abbrechen').click();
      await stabil();

      expect(auswahl.kinder()).toEqual([]);
    });

    it("highlights a marked Kind only in a followed Team's Kader", async () => {
      const { seite } = await mitAuswahl(
        [WASBUETTEL],
        [{ personId: DELON, spitzname: 'Del' }]
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
        [{ personId: ILVIO, spitzname: 'Ilvi' }]
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

      expect(auswahl.kinder()).toEqual([
        { personId: ILVIO, spitzname: 'Ilvo' },
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

      expect(auswahl.kinder()).toEqual([]);
      expect(markierKnoepfe(kaderVon(seite, 'MTV Wasbüttel'))).toHaveLength(1);
    });

    it('says so where the mark could not be stored', async () => {
      const { seite, auswahl, stabil } = await mitAuswahl([WASBUETTEL]);
      vi.spyOn(auswahl, 'markieren').mockRejectedValue(new Error('voll'));

      markierKnoepfe(kaderVon(seite, 'MTV Wasbüttel'))[0].click();
      await stabil();
      await spitznameEingeben('Ilvi', stabil);

      expect(
        text(kaderVon(seite, 'MTV Wasbüttel').querySelector('[role="alert"]'))
      ).toBe('Das ließ sich nicht speichern. Bitte noch einmal versuchen.');
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

      expect(text(seite.querySelector('[role="alert"]'))).toBe(
        'Dieses Spiel kennt der DBB nicht.'
      );
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
      expect(data.spiel).not.toHaveBeenCalled();
      expect(data.spielbericht).not.toHaveBeenCalled();
      expect(teil(seite, 'spielbericht-fehlt')).toBeNull();
    }
  );
});
