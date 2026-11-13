import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  BasketballDataError,
  type League,
  type TeamSeason,
  type ClubTeams,
} from '@wolsok/feat-shared-basketball-data';
import { LocalSelection } from '@wolsok/feat-korbjaeger-selection';
import { AUSWAHL } from '../auswahl/auswahl';
import {
  BASKETBALL_DATA,
  type KorbjaegerData,
} from '../basketball-data/basketball-data.provider';
import { NOW } from '../now';
import { Breadcrumb } from '../navigation/breadcrumb';
import { ClubPageComponent } from './club-page.component';

type VereinsTeamsRead = KorbjaegerData['clubTeams'];

const JETZT_IM_SPEC = Date.parse('2026-11-08T12:00:00+01:00');
const ZWEI_STUNDEN = 2 * 60 * 60_000;

const VORRUNDE: League = {
  id: 54862,
  name: 'Regionsvorrunde Nord Braunschweig mu12',
  association: { id: 7, name: 'Niedersachsen' },
  ageGroup: 'U12',
  gender: 'male',
  division: 'Kreisliga',
};

const WASBUETTEL: ClubTeams = {
  club: { id: 1837, name: 'MTV Wasbüttel' },
  teams: [
    {
      team: { id: 313036, name: 'MTV Wasbüttel -RST-', clubId: 1837 },
      leagues: [VORRUNDE],
    },
  ],
};

const NO_GAMES_YET: TeamSeason = {
  team: WASBUETTEL.teams[0].team,
  club: WASBUETTEL.club,
  leagues: [VORRUNDE],
  games: [],
};

async function render(
  read: VereinsTeamsRead,
  clubId = '1837',
  { forChild = false }: { forChild?: boolean } = {}
): Promise<{
  page: HTMLElement;
  breadcrumb: Breadcrumb;
  clubTeams: ReturnType<typeof vi.fn<VereinsTeamsRead>>;
}> {
  const clubTeams = vi.fn<VereinsTeamsRead>(read);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: BASKETBALL_DATA,
        // the Team's Saison, for the Kind's step: no Spiel played yet
        useValue: { clubTeams, teamGames: async () => NO_GAMES_YET },
      },
      // in memory: nothing reaches the device's storage
      { provide: AUSWAHL, useFactory: () => new LocalSelection(undefined) },
      { provide: NOW, useValue: signal(JETZT_IM_SPEC) },
    ],
  });
  const fixture = TestBed.createComponent(ClubPageComponent);
  fixture.componentRef.setInput('clubId', clubId);
  fixture.componentRef.setInput('forChild', forChild);
  await fixture.whenStable();
  return {
    page: fixture.nativeElement as HTMLElement,
    breadcrumb: TestBed.inject(Breadcrumb),
    clubTeams,
  };
}

function text(element: Element | null | undefined): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

describe('ClubPageComponent', () => {
  it("shows the Verein's name and its Teams to follow", async () => {
    const { page, clubTeams } = await render(async () => WASBUETTEL);

    expect(clubTeams).toHaveBeenCalledWith(1837, expect.anything());
    expect(text(page.querySelector('h1'))).toBe('MTV Wasbüttel');
    const team = page.querySelector('[data-qa="club-team"]');
    expect(
      team?.querySelector('[data-qa="club-team-name"]')?.getAttribute('href')
    ).toBe('/team/313036');
    expect(
      team?.querySelector('button')?.getAttribute('aria-label') ??
        text(team?.querySelector('button'))
    ).toContain('Team folgen');
  });

  it('says how old the Teams are where the last good answer stood in', async () => {
    const { page } = await render(async (_, options) => {
      options?.reading?.replaced({
        storedAt: JETZT_IM_SPEC - ZWEI_STUNDEN,
        reason: 'no-connection',
      });
      return WASBUETTEL;
    });

    expect(text(page.querySelector('[data-qa="vereins-stand"]'))).toContain(
      'Stand: vor 2 Std.'
    );
    expect(page.querySelectorAll('[data-qa="club-team"]')).toHaveLength(1);
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
      club: WASBUETTEL.club,
      teams: [],
    }));

    expect(text(page.querySelector('korb-club-teams'))).toBe(
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
    const { page, clubTeams } = await render(async () => WASBUETTEL, 'abc');

    expect(clubTeams).not.toHaveBeenCalled();
    expect(text(page.querySelector('[data-qa="vereins-teams-fehler"]'))).toBe(
      'Diesen Verein kennt der DBB nicht.'
    );
  });

  describe('in the search "Über mein Kind"', () => {
    it('puts it below the search for the Kind in the breadcrumb', async () => {
      const { breadcrumb } = await render(async () => WASBUETTEL, '1837', {
        forChild: true,
      });

      expect(breadcrumb.levels()).toEqual([
        { title: 'Korbjäger', link: ['/'] },
        { title: 'Suchen', link: ['/suchen'] },
        { title: 'Mein Kind', link: ['/suchen/kind'] },
        { title: 'MTV Wasbüttel' },
      ]);
    });

    it("asks to follow the Kind's Team first, then leads on from it", async () => {
      const { page } = await render(async () => WASBUETTEL, '1837', {
        forChild: true,
      });

      expect(
        text(page.querySelector('[data-qa="child-search-follow-first"]'))
      ).toBe(
        'Folge zuerst dem Team deines Kindes, dann markierst du es im Kader.'
      );
      const team = page.querySelector('[data-qa="club-team"]');
      expect(text(team?.querySelector('korb-child-step'))).toBe('');

      team?.querySelector<HTMLElement>('[data-qa="follow-team"]')?.click();
      await TestBed.inject(ApplicationRef).whenStable();

      expect(
        text(team?.querySelector('[data-qa="child-step-after-first-game"]'))
      ).toContain('nach seinem ersten Spiel');
    });

    it('asks to follow nothing where the Teams could not be read', async () => {
      const { page } = await render(
        async () => {
          throw new BasketballDataError('unavailable', 'DBB down');
        },
        '1837',
        { forChild: true }
      );

      expect(
        page.querySelector('[data-qa="child-search-follow-first"]')
      ).toBeNull();
    });

    it('offers no step outside it', async () => {
      const { page } = await render(async () => WASBUETTEL);

      expect(page.querySelector('korb-child-step')).toBeNull();
      expect(
        page.querySelector('[data-qa="child-search-follow-first"]')
      ).toBeNull();
    });
  });
});
