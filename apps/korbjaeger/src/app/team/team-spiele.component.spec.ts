import { TestBed } from '@angular/core/testing';
import {
  BasketballDataError,
  type BasketballData,
  type Liga,
  type Spiel,
  type SpielPartei,
  type Team,
  type TeamSaison,
} from '@wolsok/feat-shared-basketball-data';
import { BASKETBALL_DATA } from '../basketball-data/basketball-data.provider';
import { TeamSpieleComponent } from './team-spiele.component';

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

function saison(spiele: readonly Spiel[]): TeamSaison {
  return {
    team: UNSER_TEAM,
    verein: { id: 1837, name: 'MTV Wasbüttel' },
    ligen: [TESTSPIELE, VORRUNDE],
    spiele,
  };
}

/** `BasketballData` answering `teamSpiele` with `read`, nothing else. */
function fakeData(
  read: (team: number) => Promise<TeamSaison>
): Pick<BasketballData, 'teamSpiele'> {
  return { teamSpiele: vi.fn(read) };
}

async function render(
  data: Pick<BasketballData, 'teamSpiele'>,
  teamId = '313036'
): Promise<HTMLElement> {
  TestBed.configureTestingModule({
    providers: [{ provide: BASKETBALL_DATA, useValue: data }],
  });
  const fixture = TestBed.createComponent(TeamSpieleComponent);
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

describe('TeamSpieleComponent', () => {
  it("reads the Team of the page's id", async () => {
    const data = fakeData(async () => saison([]));

    await render(data, '313036');

    expect(data.teamSpiele).toHaveBeenCalledWith(313036);
  });

  it('names the Team', async () => {
    const page = await render(fakeData(async () => saison([])));

    expect(page.querySelector('h1')?.textContent).toContain('MTV Wasbüttel');
  });

  it('lists every Spiel of every Liga by date and time', async () => {
    const page = await render(
      fakeData(async () =>
        saison([
          spiel({ id: 3, datum: '2026-09-20', uhrzeit: '09:00' }),
          spiel({ id: 1, datum: '2026-08-29', ligaId: TESTSPIELE.id }),
          spiel({ id: 4, datum: '2026-09-20', uhrzeit: '15:00' }),
          spiel({ id: 2, datum: '2026-09-12' }),
        ])
      )
    );

    expect(spielZeilen(page).map((zeile) => feld(zeile, 'datum'))).toEqual([
      'Sa., 29.08.2026',
      'Sa., 12.09.2026',
      'So., 20.09.2026',
      'So., 20.09.2026',
    ]);
    expect(spielZeilen(page).map((zeile) => feld(zeile, 'uhrzeit'))).toEqual([
      '10:00',
      '10:00',
      '09:00',
      '15:00',
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

  it('says so when the Team has no Spiele', async () => {
    const page = await render(fakeData(async () => saison([])));

    expect(page.textContent).toContain('Noch keine Spiele in dieser Saison.');
  });

  it('shows that it is loading', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: BASKETBALL_DATA,
          useValue: fakeData(() => new Promise<TeamSaison>(() => undefined)),
        },
      ],
    });
    const fixture = TestBed.createComponent(TeamSpieleComponent);
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
});
