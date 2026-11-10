import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  BasketballDataError,
  type Liga,
  type VereinsTeams,
} from '@wolsok/feat-shared-basketball-data';
import { LokaleAuswahl } from '@wolsok/feat-korbjaeger-auswahl';
import { AUSWAHL } from '../auswahl/auswahl';
import {
  BASKETBALL_DATA,
  type KorbjaegerData,
} from '../basketball-data/basketball-data.provider';
import { JETZT } from '../jetzt';
import { Breadcrumb } from '../navigation/breadcrumb';
import { ClubPageComponent } from './club-page.component';

type VereinsTeamsRead = KorbjaegerData['vereinsTeams'];

const JETZT_IM_SPEC = Date.parse('2026-11-08T12:00:00+01:00');
const ZWEI_STUNDEN = 2 * 60 * 60_000;

const VORRUNDE: Liga = {
  id: 54862,
  name: 'Regionsvorrunde Nord Braunschweig mu12',
  verband: { id: 7, name: 'Niedersachsen' },
  altersklasse: 'U12',
  geschlecht: 'männlich',
  spielklasse: 'Kreisliga',
};

const WASBUETTEL: VereinsTeams = {
  verein: { id: 1837, name: 'MTV Wasbüttel' },
  teams: [
    {
      team: { id: 313036, name: 'MTV Wasbüttel -RST-', vereinId: 1837 },
      ligen: [VORRUNDE],
    },
  ],
};

async function render(
  read: VereinsTeamsRead,
  clubId = '1837'
): Promise<{
  page: HTMLElement;
  breadcrumb: Breadcrumb;
  vereinsTeams: ReturnType<typeof vi.fn<VereinsTeamsRead>>;
}> {
  const vereinsTeams = vi.fn<VereinsTeamsRead>(read);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: BASKETBALL_DATA, useValue: { vereinsTeams } },
      // in memory: nothing reaches the device's storage
      { provide: AUSWAHL, useFactory: () => new LokaleAuswahl(undefined) },
      { provide: JETZT, useValue: signal(JETZT_IM_SPEC) },
    ],
  });
  const fixture = TestBed.createComponent(ClubPageComponent);
  fixture.componentRef.setInput('clubId', clubId);
  await fixture.whenStable();
  return {
    page: fixture.nativeElement as HTMLElement,
    breadcrumb: TestBed.inject(Breadcrumb),
    vereinsTeams,
  };
}

function text(element: Element | null | undefined): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

describe('ClubPageComponent', () => {
  it("shows the Verein's name and its Teams to follow", async () => {
    const { page, vereinsTeams } = await render(async () => WASBUETTEL);

    expect(vereinsTeams).toHaveBeenCalledWith(1837, expect.anything());
    expect(text(page.querySelector('h1'))).toBe('MTV Wasbüttel');
    const team = page.querySelector('[data-qa="vereins-team"]');
    expect(
      team?.querySelector('[data-qa="vereins-team-name"]')?.getAttribute('href')
    ).toBe('/team/313036');
    expect(
      team?.querySelector('button')?.getAttribute('aria-label') ??
        text(team?.querySelector('button'))
    ).toContain('Team folgen');
  });

  it('says how old the Teams are where the last good answer stood in', async () => {
    const { page } = await render(async (_, options) => {
      options?.lesung?.ersetzt({
        gespeichertAm: JETZT_IM_SPEC - ZWEI_STUNDEN,
        grund: 'keine-verbindung',
      });
      return WASBUETTEL;
    });

    expect(text(page.querySelector('[data-qa="vereins-stand"]'))).toContain(
      'Stand: vor 2 Std.'
    );
    expect(page.querySelectorAll('[data-qa="vereins-team"]')).toHaveLength(1);
  });

  it("puts the Verein's name below the search in the breadcrumb", async () => {
    const { breadcrumb } = await render(async () => WASBUETTEL);

    expect(breadcrumb.levels()).toEqual([
      { title: 'Korbjäger', link: ['/'] },
      { title: 'Suchen', link: ['/suchen'] },
      { title: 'MTV Wasbüttel' },
    ]);
  });

  it('says where the Verein has no Team in recent weeks', async () => {
    const { page } = await render(async () => ({
      verein: WASBUETTEL.verein,
      teams: [],
    }));

    expect(text(page.querySelector('korb-vereins-teams'))).toBe(
      'Keine Teams des Vereins in den letzten Wochen.'
    );
  });

  it('says the DBB does not know a Verein it answers as not found', async () => {
    const { page } = await render(async () => {
      throw new BasketballDataError('not-found', 'no such Verein');
    });

    expect(text(page.querySelector('h1'))).toBe('Verein');
    expect(text(page.querySelector('[data-qa="vereins-teams-fehler"]'))).toBe(
      'Diesen Verein kennt der DBB nicht.'
    );
  });

  it('reads nothing for an id that is no DBB id', async () => {
    const { page, vereinsTeams } = await render(async () => WASBUETTEL, 'abc');

    expect(vereinsTeams).not.toHaveBeenCalled();
    expect(text(page.querySelector('[data-qa="vereins-teams-fehler"]'))).toBe(
      'Diesen Verein kennt der DBB nicht.'
    );
  });
});
