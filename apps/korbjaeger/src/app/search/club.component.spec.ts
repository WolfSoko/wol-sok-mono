import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LokaleAuswahl } from '@wolsok/feat-korbjaeger-auswahl';
import {
  BasketballDataError,
  type Liga,
  type VereinsTeams,
} from '@wolsok/feat-shared-basketball-data';
import { AUSWAHL } from '../auswahl/auswahl';
import {
  BASKETBALL_DATA,
  type KorbjaegerData,
} from '../basketball-data/basketball-data.provider';
import { KEIN_VEREIN } from '../fehler/fehler-text';
import { Breadcrumb } from '../navigation/breadcrumb';
import { ClubComponent } from './club.component';

type VereinsTeamsRead = KorbjaegerData['vereinsTeams'];

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

const VEREIN: VereinsTeams = {
  verein: { id: 1837, name: 'MTV Wasbüttel' },
  teams: [
    {
      team: { id: 313036, name: 'MTV Wasbüttel', vereinId: 1837 },
      ligen: [liga(54862, 'U12 Vorrunde Nord')],
    },
    {
      team: { id: 317618, name: 'MTV Wasbüttel 2', vereinId: 1837 },
      ligen: [liga(54900, 'Regionsvorrunde Nordwest mu14')],
    },
  ],
};

async function render(read: VereinsTeamsRead, clubId = '1837') {
  const vereinsTeams = vi.fn<VereinsTeamsRead>(read);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: BASKETBALL_DATA, useValue: { vereinsTeams } },
      // in memory: nothing reaches the device's storage
      { provide: AUSWAHL, useFactory: () => new LokaleAuswahl(undefined) },
    ],
  });
  const fixture = TestBed.createComponent(ClubComponent);
  fixture.componentRef.setInput('clubId', clubId);
  await fixture.whenStable();
  return { page: fixture.nativeElement as HTMLElement, vereinsTeams };
}

function levels(): string[] {
  return TestBed.inject(Breadcrumb)
    .levels()
    .map(({ title }) => title);
}

describe('ClubComponent', () => {
  it('lists every Team of the Verein with its page and the control to follow it', async () => {
    const { page, vereinsTeams } = await render(async () => VEREIN);

    expect(vereinsTeams).toHaveBeenCalledWith(1837, expect.anything());
    expect(page.querySelector('h1')?.textContent?.trim()).toBe('MTV Wasbüttel');
    const teams = [...page.querySelectorAll('[data-qa="vereins-team"]')];
    expect(
      teams.map((team) =>
        team
          .querySelector('[data-qa="vereins-team-name"]')
          ?.getAttribute('href')
      )
    ).toEqual(['/team/313036', '/team/317618']);
    expect(
      teams.map((team) => team.querySelector('korb-team-folgen button'))
    ).not.toContain(null);
  });

  it('puts the Verein below the search in the breadcrumb', async () => {
    await render(async () => VEREIN);

    expect(levels()).toEqual(['Korbjäger', 'Suchen', 'MTV Wasbüttel']);
    expect(TestBed.inject(Breadcrumb).parentLink()).toEqual(['/suchen']);
  });

  it('says so where the Verein played no Spiele these weeks', async () => {
    const { page } = await render(async () => ({ ...VEREIN, teams: [] }));

    expect(
      page.querySelector('[data-qa="vereins-teams-leer"]')?.textContent?.trim()
    ).toBe('Keine Teams des Vereins in den letzten Wochen.');
  });

  it('says the DBB knows no such Verein, for an id it does not know', async () => {
    const { page } = await render(async () => {
      throw new BasketballDataError('not-found', 'no such Verein');
    });

    expect(
      page
        .querySelector('[data-qa="vereins-teams-fehler"]')
        ?.textContent?.trim()
    ).toBe(KEIN_VEREIN);
    expect(levels()).toEqual(['Korbjäger', 'Suchen', 'Verein']);
  });

  it('reads nothing for an id that is no DBB id', async () => {
    const { page, vereinsTeams } = await render(async () => VEREIN, 'abc');

    expect(vereinsTeams).not.toHaveBeenCalled();
    expect(
      page
        .querySelector('[data-qa="vereins-teams-fehler"]')
        ?.textContent?.trim()
    ).toBe(KEIN_VEREIN);
  });
});
