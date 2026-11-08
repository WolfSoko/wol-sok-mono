import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  BasketballDataError,
  type Liga,
  type Tabelle,
  type TabellenZeile,
} from '@wolsok/feat-shared-basketball-data';
import {
  BASKETBALL_DATA,
  type KorbjaegerData,
} from '../basketball-data/basketball-data.provider';
import type { KorbReadOptions } from '../basketball-data/lesung';
import { JETZT } from '../jetzt';
import { TeamTabelleComponent } from './team-tabelle.component';

const UNSER_TEAM_ID = 313036;
const JETZT_IM_SPEC = Date.parse('2026-11-08T12:00:00+01:00');

const VORRUNDE: Liga = {
  id: 54862,
  name: 'Regionsvorrunde Nord Braunschweig mu12',
  verband: { id: 7, name: 'Niedersachsen' },
  altersklasse: 'U12',
  geschlecht: 'mix',
  spielklasse: 'Regionsliga',
};

function zeile(
  rang: number,
  id: number,
  name: string,
  [koerbe, gegenkoerbe]: readonly [number, number]
): TabellenZeile {
  return {
    rang,
    partei: { art: 'team', team: { id, name, vereinId: id } },
    spiele: 5,
    siege: 5 - rang,
    niederlagen: rang,
    punkte: 2 * (5 - rang),
    koerbe,
    gegenkoerbe,
    korbdifferenz: koerbe - gegenkoerbe,
  };
}

const TABELLE: Tabelle = {
  liga: VORRUNDE,
  zeilen: [
    zeile(1, 313040, 'TV Jahn Wolfsburg', [510, 191]),
    zeile(2, UNSER_TEAM_ID, 'MTV Wasbüttel', [470, 204]),
    zeile(3, 322695, 'SV Groß Schwülper', [102, 575]),
  ],
};

type TabelleRead = KorbjaegerData['tabelle'];

/** `KorbjaegerData` answering `tabelle` with `read`. */
function fakeData(read: TabelleRead): {
  readonly tabelle: ReturnType<typeof vi.fn<TabelleRead>>;
} {
  return { tabelle: vi.fn<TabelleRead>(read) };
}

function create(
  data: ReturnType<typeof fakeData>
): ComponentFixture<TeamTabelleComponent> {
  TestBed.configureTestingModule({
    providers: [
      { provide: BASKETBALL_DATA, useValue: data },
      { provide: JETZT, useValue: signal(JETZT_IM_SPEC) },
    ],
  });
  const fixture = TestBed.createComponent(TeamTabelleComponent);
  fixture.componentRef.setInput('liga', VORRUNDE);
  fixture.componentRef.setInput('teamId', UNSER_TEAM_ID);
  return fixture;
}

async function render(data: ReturnType<typeof fakeData>): Promise<HTMLElement> {
  const fixture = create(data);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

function text(element: Element | null | undefined): string | undefined {
  return element?.textContent?.replace(/\s+/g, ' ').trim();
}

function zeilen(page: HTMLElement): HTMLElement[] {
  return [...page.querySelectorAll<HTMLElement>('[data-qa="tabelle-zeile"]')];
}

function zellen(zeile: HTMLElement): (string | undefined)[] {
  return [...zeile.querySelectorAll('td')].map(text);
}

describe('TeamTabelleComponent', () => {
  it('shows its last good Tabelle with its age where the read fell back on it', async () => {
    const page = await render(
      fakeData(async (_liga, options?: KorbReadOptions) => {
        options?.lesung?.ersetzt({
          gespeichertAm: JETZT_IM_SPEC - 30 * 60_000,
          grund: 'unavailable',
        });
        return TABELLE;
      })
    );

    expect(page.querySelector('[data-qa="stand"]')?.textContent).toContain(
      'DBB nicht erreichbar · Stand: vor 30 Min.'
    );
    expect(zeilen(page)).toHaveLength(3);
  });

  it('reads the Tabelle of its Liga', async () => {
    const data = fakeData(async () => TABELLE);

    await render(data);

    expect(data.tabelle).toHaveBeenCalledWith(
      54862,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('is headed by the Liga', async () => {
    const page = await render(fakeData(async () => TABELLE));

    expect(text(page.querySelector('h3'))).toBe(VORRUNDE.name);
    expect(page.querySelector('table')?.getAttribute('aria-labelledby')).toBe(
      page.querySelector('h3')?.id
    );
  });

  it('shows rank, Team, games, wins, losses, points for and against and the difference', async () => {
    const page = await render(fakeData(async () => TABELLE));

    // short on screen, in full for screen readers
    expect(
      [...page.querySelectorAll('th')].map((th) => [
        text(th),
        th.getAttribute('aria-label') ?? text(th),
      ])
    ).toEqual([
      ['Pl.', 'Platz'],
      ['Team', 'Team'],
      ['Sp.', 'Spiele'],
      ['S', 'Siege'],
      ['N', 'Niederlagen'],
      ['Körbe', 'Körbe'],
      ['Diff.', 'Differenz'],
    ]);
    expect(zellen(zeilen(page)[0])).toEqual([
      '1',
      'TV Jahn Wolfsburg',
      '5',
      '4',
      '1',
      '510:191',
      '+319',
    ]);
    expect(zeilen(page).map((z) => zellen(z)[0])).toEqual(['1', '2', '3']);
  });

  it("highlights the Team's own line, for screen readers too", async () => {
    const page = await render(fakeData(async () => TABELLE));

    const eigene = zeilen(page).filter(
      (z) => z.getAttribute('aria-current') === 'true'
    );
    expect(eigene).toHaveLength(1);
    expect(eigene[0].classList).toContain('eigenes-team');
    expect(text(eigene[0].querySelector('.cdk-visually-hidden'))).toBe(
      '(dein Team)'
    );
    expect(zellen(eigene[0])[1]).toBe('MTV Wasbüttel (dein Team)');
    expect(
      zeilen(page).filter((z) => z.classList.contains('eigenes-team'))
    ).toHaveLength(1);
  });

  it('says so for a Liga the DBB keeps no Tabelle for', async () => {
    const page = await render(
      fakeData(async () => ({ liga: VORRUNDE, zeilen: [] }))
    );

    expect(page.querySelector('table')).toBeNull();
    expect(page.textContent).toContain(
      'Für diese Liga führt der DBB keine Tabelle.'
    );
  });

  it('shows that it is loading', () => {
    const fixture = create(
      fakeData(() => new Promise<Tabelle>(() => undefined))
    );
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;
    expect(
      page.querySelector('mat-progress-bar')?.getAttribute('aria-label')
    ).toBe('Tabelle wird geladen');
  });

  it.each([
    ['not-found', 'Diese Tabelle kennt der DBB nicht.'],
    ['unavailable', 'Der DBB ist gerade nicht erreichbar.'],
    ['unexpected-shape', 'Die Daten des DBB ließen sich nicht lesen.'],
  ] as const)('explains a %s error under its Liga', async (kind, message) => {
    const page = await render(
      fakeData(async () => {
        throw new BasketballDataError(kind, 'DBB: nope');
      })
    );

    expect(text(page.querySelector('h3'))).toBe(VORRUNDE.name);
    expect(
      page.querySelector('[data-qa="tabelle-fehler"]')?.textContent
    ).toContain(message);
    expect(page.querySelector('table')).toBeNull();
    // the page holds a Tabelle per Liga: a DBB outage must not alert once each
    expect(
      page.querySelector('[role="alert"], [role="status"], [aria-live]')
    ).toBeNull();
  });
});
