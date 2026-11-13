import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  BasketballDataError,
  type League,
  type Standings,
  type StandingsRow,
} from '@wolsok/feat-shared-basketball-data';
import {
  BASKETBALL_DATA,
  type KorbjaegerData,
} from '../basketball-data/basketball-data.provider';
import type { KorbReadOptions } from '../basketball-data/reading';
import { NOW } from '../now';
import { TeamStandingsComponent } from './team-standings.component';

const OUR_TEAM_ID = 313036;
const NOW_IN_SPEC = Date.parse('2026-11-08T12:00:00+01:00');

const FIRST_ROUND: League = {
  id: 54862,
  name: 'Regionsvorrunde Nord Braunschweig mu12',
  association: { id: 7, name: 'Niedersachsen' },
  ageGroup: 'U12',
  gender: 'mixed',
  division: 'Regionsliga',
};

function row(
  rank: number,
  id: number,
  name: string,
  [pointsFor, pointsAgainst]: readonly [number, number]
): StandingsRow {
  return {
    rank,
    participant: { kind: 'team', team: { id, name, clubId: id } },
    games: 5,
    wins: 5 - rank,
    losses: rank,
    points: 2 * (5 - rank),
    pointsFor,
    pointsAgainst,
    pointDifference: pointsFor - pointsAgainst,
  };
}

const STANDINGS: Standings = {
  league: FIRST_ROUND,
  rows: [
    row(1, 313040, 'TV Jahn Wolfsburg', [510, 191]),
    row(2, OUR_TEAM_ID, 'MTV Wasbüttel', [470, 204]),
    row(3, 322695, 'SV Groß Schwülper', [102, 575]),
  ],
};

type StandingsRead = KorbjaegerData['standings'];

/** `KorbjaegerData` answering `standings` with `read`. */
function fakeData(read: StandingsRead): {
  readonly standings: ReturnType<typeof vi.fn<StandingsRead>>;
} {
  return { standings: vi.fn<StandingsRead>(read) };
}

function create(
  data: ReturnType<typeof fakeData>
): ComponentFixture<TeamStandingsComponent> {
  TestBed.configureTestingModule({
    providers: [
      { provide: BASKETBALL_DATA, useValue: data },
      { provide: NOW, useValue: signal(NOW_IN_SPEC) },
    ],
  });
  const fixture = TestBed.createComponent(TeamStandingsComponent);
  fixture.componentRef.setInput('league', FIRST_ROUND);
  fixture.componentRef.setInput('teamId', OUR_TEAM_ID);
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

function rows(page: HTMLElement): HTMLElement[] {
  return [...page.querySelectorAll<HTMLElement>('[data-qa="standings-row"]')];
}

function cells(tableRow: HTMLElement): (string | undefined)[] {
  return [...tableRow.querySelectorAll('td')].map(text);
}

describe('TeamStandingsComponent', () => {
  it('shows its last good Tabelle with its age where the read fell back on it', async () => {
    const page = await render(
      fakeData(async (_league, options?: KorbReadOptions) => {
        options?.reading?.replaced({
          storedAt: NOW_IN_SPEC - 30 * 60_000,
          reason: 'unavailable',
        });
        return STANDINGS;
      })
    );

    expect(page.querySelector('[data-qa="as-of"]')?.textContent).toContain(
      'DBB nicht erreichbar · Stand: vor 30 Min.'
    );
    expect(rows(page)).toHaveLength(3);
  });

  it('reads the Tabelle of its Liga', async () => {
    const data = fakeData(async () => STANDINGS);

    await render(data);

    expect(data.standings).toHaveBeenCalledWith(
      54862,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('is headed by the Liga', async () => {
    const page = await render(fakeData(async () => STANDINGS));

    expect(text(page.querySelector('h3'))).toBe(FIRST_ROUND.name);
    expect(page.querySelector('table')?.getAttribute('aria-labelledby')).toBe(
      page.querySelector('h3')?.id
    );
  });

  it('shows rank, Team, games, wins, losses, points for and against and the difference', async () => {
    const page = await render(fakeData(async () => STANDINGS));

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
    expect(cells(rows(page)[0])).toEqual([
      '1',
      'TV Jahn Wolfsburg',
      '5',
      '4',
      '1',
      '510:191',
      '+319',
    ]);
    expect(rows(page).map((z) => cells(z)[0])).toEqual(['1', '2', '3']);
  });

  it("highlights the Team's own line, for screen readers too", async () => {
    const page = await render(fakeData(async () => STANDINGS));

    const own = rows(page).filter(
      (z) => z.getAttribute('aria-current') === 'true'
    );
    expect(own).toHaveLength(1);
    expect(own[0].classList).toContain('own-team');
    expect(text(own[0].querySelector('.cdk-visually-hidden'))).toBe(
      '(dein Team)'
    );
    expect(cells(own[0])[1]).toBe('MTV Wasbüttel (dein Team)');
    expect(
      rows(page).filter((z) => z.classList.contains('own-team'))
    ).toHaveLength(1);
  });

  it('says so for a Liga the DBB keeps no Tabelle for', async () => {
    const page = await render(
      fakeData(async () => ({ league: FIRST_ROUND, rows: [] }))
    );

    expect(page.querySelector('table')).toBeNull();
    expect(page.textContent).toContain(
      'Für diese Liga führt der DBB keine Tabelle.'
    );
  });

  it('shows that it is loading', () => {
    const fixture = create(
      fakeData(() => new Promise<Standings>(() => undefined))
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

    expect(text(page.querySelector('h3'))).toBe(FIRST_ROUND.name);
    expect(
      page.querySelector('[data-qa="standings-error"]')?.textContent
    ).toContain(message);
    expect(page.querySelector('table')).toBeNull();
    // the page holds a Tabelle per Liga: a DBB outage must not alert once each
    expect(
      page.querySelector('[role="alert"], [role="status"], [aria-live]')
    ).toBeNull();
  });
});
