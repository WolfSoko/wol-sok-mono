import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  BasketballDataError,
  type Liga,
  type Spiel,
  type SpielPartei,
  type Team,
  type TeamId,
  type TeamSaison,
} from '@wolsok/feat-shared-basketball-data';
import { AUSWAHL } from '../auswahl/auswahl';
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

/** `KorbjaegerData` answering each Team's Spiele from `saisons`. */
function fakeData(
  saisons: readonly (TeamSaison | { teamId: TeamId; fehler: Error })[]
): { readonly teamSpiele: ReturnType<typeof vi.fn<TeamSpieleRead>> } {
  return {
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

async function render(
  data: ReturnType<typeof fakeData>,
  gefolgt: readonly TeamId[]
): Promise<HTMLElement> {
  const auswahl = new LokaleAuswahl(undefined);
  for (const teamId of gefolgt) {
    await auswahl.folgen(teamId);
  }
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: BASKETBALL_DATA, useValue: data },
      { provide: HEUTE, useValue: signal(HEUTE_IM_SPEC) },
      { provide: AUSWAHL, useValue: auswahl },
    ],
  });
  const fixture = TestBed.createComponent(UeberblickComponent);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
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
  it('invites to follow a first Team while none is followed', async () => {
    const data = fakeData([]);

    const seite = await render(data, []);

    expect(eintraege(seite)).toEqual([]);
    expect(text(seite.querySelector('[data-qa="ueberblick-leer"]'))).toContain(
      'Du folgst noch keinem Team.'
    );
    expect(data.teamSpiele).not.toHaveBeenCalled();
  });

  it('shows the next Spiel with day, time, home or away and opponent', async () => {
    const seite = await render(
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
    const seite = await render(
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
    const seite = await render(
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
    const seite = await render(fakeData([saison(WASBUETTEL)]), [WASBUETTEL.id]);

    expect(text(eintraege(seite)[0])).toContain(
      'Noch keine Spiele in dieser Saison.'
    );
  });

  it('orders Meine Teams by their next Spiel, Teams with none last', async () => {
    const seite = await render(
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
    const seite = await render(
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
    const seite = await render(
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
    const seite = await render(fakeData([saison(WASBUETTEL)]), [WASBUETTEL.id]);

    expect(eintraege(seite)[0].querySelector('a')?.getAttribute('href')).toBe(
      '/team/313036'
    );
  });

  it('keeps the other Teams when one fails', async () => {
    const seite = await render(
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
});
