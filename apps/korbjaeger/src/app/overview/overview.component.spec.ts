import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSnackBarHarness } from '@angular/material/snack-bar/testing';
import { provideRouter } from '@angular/router';
import {
  BasketballDataError,
  type NamedPlayer,
  type Venue,
  type League,
  type GameDetails,
  type Game,
  type Participant,
  type GameReport,
  type Team,
  type TeamId,
  type TeamSeason,
  type ClubTeams,
} from '@wolsok/feat-shared-basketball-data';
import { AUSWAHL } from '../auswahl/auswahl';
import {
  type Selection,
  LocalSelection,
} from '@wolsok/feat-korbjaeger-selection';
import {
  BASKETBALL_DATA,
  type KorbjaegerData,
} from '../basketball-data/basketball-data.provider';
import type { KorbReadOptions } from '../basketball-data/reading';
import { TODAY } from '../today';
import { NOW } from '../now';
import { MY_CHILD } from './overview-view';
import { OverviewComponent } from './overview.component';
import { fakeSelection } from '@wolsok/feat-korbjaeger-selection/testing';
import { KontoSitzung } from '../konto/konto-sitzung';
import {
  FakeKontoDienst,
  MerkerImSpec,
} from '../konto/testing/fake-konto-dienst';

/** The day the specs run on. */
const TODAY_IN_SPEC = '2026-11-08';
/** Noon of `TODAY_IN_SPEC` in Germany. */
const NOW_IN_SPEC = Date.parse('2026-11-08T12:00:00+01:00');

const VORRUNDE: League = {
  id: 54862,
  name: 'U12 Vorrunde Nord',
  association: { id: 7, name: 'Niedersachsen' },
  ageGroup: 'U12',
  gender: 'mixed',
  division: 'Kreisliga',
};

function team(id: TeamId, name: string): Team {
  return { id, name, clubId: id };
}

const WASBUETTEL = team(313036, 'MTV Wasbüttel');
const WASBUETTEL_U14 = team(313040, 'MTV Wasbüttel U14');
const GIFHORN = team(201500, 'MTV Gifhorn');
const OESINGEN = team(201765, 'SV Groß Oesingen');

function participantOf(team: Team): Participant {
  return { kind: 'team', team };
}

const PLAYED_78_47: Game['status'] = {
  kind: 'played',
  result: { home: 78, away: 47 },
  confirmed: true,
};

let nextGameId = 1;

/** A Spiel of `heim` at home against `gast`. */
function game(
  home: Team,
  away: Team,
  datum: string,
  overrides: Partial<Game> = {}
): Game {
  return {
    id: nextGameId++,
    leagueId: VORRUNDE.id,
    matchday: 1,
    date: datum,
    time: '10:00',
    home: participantOf(home),
    away: participantOf(away),
    status: { kind: 'scheduled' },
    ...overrides,
  };
}

function season(von: Team, ...games: Game[]): TeamSeason {
  return {
    team: von,
    club: { id: von.clubId, name: von.name },
    leagues: [VORRUNDE],
    games,
  };
}

type TeamGamesRead = KorbjaegerData['teamGames'];
type GameRead = KorbjaegerData['game'];
type ClubTeamsRead = KorbjaegerData['clubTeams'];
type ReportRead = KorbjaegerData['gameReport'];

/** No Spiel has a Spielbericht yet. */
const WITHOUT_REPORT: ReportRead = async () => undefined;

/** A Spielbericht read that never settles. */
const NEVER_REPORT = new Promise<never>(() => undefined);

/** What a Kind's card says where not every Team could be read. */
const VIELLEICHT_MEHR =
  'Nicht alles zu deinen Teams ließ sich lesen: Vielleicht spielt dein Kind noch in einem weiteren.';

/** A Verein whose recent Spiele show no Team. */
const WITHOUT_TEAMS: ClubTeamsRead = async (clubId) => ({
  club: { id: clubId, name: 'Verein' },
  teams: [],
});

/** Where every Spiel of the specs is played, unless one says otherwise. */
const SPORTS_HALL: Venue = {
  name: 'Sporthalle am Wasserturm',
  street: 'Turmweg 1',
  postcode: '38518',
  town: 'Gifhorn',
};

/** Every Spiel's details, in the Sporthalle. */
const inTheSportsHall: GameRead = async (gameId) => ({
  game: game(WASBUETTEL, GIFHORN, '2026-11-14', { id: gameId }),
  league: VORRUNDE,
  venue: SPORTS_HALL,
  quarters: [],
  overtimes: [],
});

/**
 * `KorbjaegerData` answering each Team's Spiele from `seasons`, and every
 * Spiel's details by `details`.
 */
function fakeData(
  seasons: readonly (TeamSeason | { teamId: TeamId; error: Error })[],
  details: GameRead = inTheSportsHall,
  clubTeams: ClubTeamsRead = WITHOUT_TEAMS,
  gameReport: ReportRead = WITHOUT_REPORT
): {
  readonly teamGames: ReturnType<typeof vi.fn<TeamGamesRead>>;
  readonly game: ReturnType<typeof vi.fn<GameRead>>;
  readonly clubTeams: ReturnType<typeof vi.fn<ClubTeamsRead>>;
  readonly gameReport: ReturnType<typeof vi.fn<ReportRead>>;
} {
  return {
    game: vi.fn<GameRead>(details),
    clubTeams: vi.fn<ClubTeamsRead>(clubTeams),
    gameReport: vi.fn<ReportRead>(gameReport),
    teamGames: vi.fn<TeamGamesRead>(async (teamId) => {
      const found = seasons.find((s) =>
        'error' in s ? s.teamId === teamId : s.team.id === teamId
      );
      if (found === undefined || 'error' in found) {
        throw found?.error ?? new BasketballDataError('not-found', '');
      }
      return found;
    }),
  };
}

/**
 * Renders the overview on `data`, following `gefolgt` (or with that
 * `Selection`), once the reads that settle have settled.
 */
async function render(
  data: Pick<KorbjaegerData, 'teamGames' | 'game' | 'clubTeams' | 'gameReport'>,
  followed: readonly TeamId[] | Selection
): Promise<{
  readonly page: HTMLElement;
  readonly selection: Selection;
  /** Waits for the reads that settle and the page. */
  readonly settled: () => Promise<void>;
  /** The snackbars, open over the page (`document`'s root). */
  readonly bars: HarnessLoader;
}> {
  const selection = 'teams' in followed ? followed : await following(followed);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: BASKETBALL_DATA, useValue: data },
      { provide: TODAY, useValue: signal(TODAY_IN_SPEC) },
      { provide: NOW, useValue: signal(NOW_IN_SPEC) },
      { provide: AUSWAHL, useValue: selection },
    ],
  });
  const fixture = TestBed.createComponent(OverviewComponent);
  // not whenStable: it waits for every read, and some never settle here
  const settled = async (): Promise<void> => {
    // the Kader search starts once a Saison is read, reading on a Spiel
    // at a time: a few rounds let it settle
    for (let runde = 0; runde < 8; runde++) {
      fixture.detectChanges();
      await new Promise((resolve) => setTimeout(resolve));
    }
    fixture.detectChanges();
  };
  await settled();
  return {
    page: fixture.nativeElement as HTMLElement,
    selection,
    settled,
    bars: TestbedHarnessEnvironment.documentRootLoader(fixture),
  };
}

async function following(teams: readonly TeamId[]): Promise<LocalSelection> {
  const selection = new LocalSelection(undefined);
  for (const teamId of teams) {
    await selection.follow(teamId);
  }
  return selection;
}

function entries(page: HTMLElement): HTMLElement[] {
  return [...page.querySelectorAll<HTMLElement>('[data-qa="overview-team"]')];
}

function text(element: Element | null | undefined): string | undefined {
  return element?.textContent?.replace(/\s+/g, ' ').trim();
}

function part(entry: HTMLElement, name: string): HTMLElement | null {
  return entry.querySelector<HTMLElement>(`[data-qa="overview-${name}"]`);
}

function teamNamen(page: HTMLElement): (string | undefined)[] {
  return entries(page).map((entry) => text(part(entry, 'name')));
}

describe('OverviewComponent', () => {
  it('claims nothing before Meine Teams are read', async () => {
    const data = fakeData([]);

    const { page } = await render(
      data,
      fakeSelection({
        teams: signal(undefined),
        children: signal(undefined),
      })
    );

    expect(page.querySelector('[data-qa="overview-empty"]')).toBeNull();
    expect(page.querySelector('a[href="/suchen"]')).toBeNull();
    expect(entries(page)).toEqual([]);
    expect(data.teamGames).not.toHaveBeenCalled();
  });

  it('says the account cannot be read, rather than show what it read before', async () => {
    const dienst = new FakeKontoDienst();
    const sitzung = new KontoSitzung(
      new LocalSelection(undefined),
      async () => dienst,
      new MerkerImSpec()
    );
    await sitzung.starten();
    await sitzung.anmelden();
    await dienst.kontoAuswahl.follow(WASBUETTEL.id);
    const { page, settled } = await render(
      fakeData([season(WASBUETTEL)]),
      sitzung.auswahl
    );
    expect(teamNamen(page)).toEqual(['MTV Wasbüttel']);

    dienst.lesefehler?.({ code: 'unavailable' });
    await settled();

    expect(text(page.querySelector('[data-qa="overview-unreadable"]'))).toBe(
      'Meine Teams und Kinder lassen sich gerade nicht lesen. Bitte die App neu laden.'
    );
    expect(entries(page)).toEqual([]);
    expect(page.querySelector('a[href="/suchen"]')).toBeNull();
  });

  it('invites to follow a first Team while none is followed', async () => {
    const data = fakeData([]);

    const { page } = await render(data, []);

    expect(entries(page)).toEqual([]);
    expect(text(page.querySelector('[data-qa="overview-empty"]'))).toContain(
      'Du folgst noch keinem Team.'
    );
    expect(data.teamGames).not.toHaveBeenCalled();
  });

  it('offers to set up a first Team while none is followed', async () => {
    const { page } = await render(fakeData([]), []);

    const link = page.querySelector<HTMLAnchorElement>(
      '[data-qa="overview-empty"] a'
    );
    expect(text(link)).toBe('Team suchen');
    expect(link?.getAttribute('href')).toBe('/suchen');
    expect(link?.getAttribute('matButton')).toBe('filled');
    expect(link?.classList).toContain('mat-mdc-button-base');
    expect(page.querySelector('[data-qa="overview-other-team"]')).toBeNull();
  });

  it("labels a card with its Team's last good Spiele and their age", async () => {
    const data = fakeData([]);
    data.teamGames.mockImplementation(
      async (_team, options?: KorbReadOptions) => {
        options?.reading?.replaced({
          storedAt: NOW_IN_SPEC - 3 * 60 * 60_000,
          reason: 'no-internet',
        });
        return season(WASBUETTEL);
      }
    );

    const { page } = await render(data, [WASBUETTEL.id]);

    expect(text(part(entries(page)[0], 'as-of'))).toContain(
      'Offline · Stand: vor 3 Std.'
    );
  });

  it("labels a card with the oldest Stand of what it shows, its next Spiel's Halle too", async () => {
    const STUNDE = 60 * 60_000;
    const data = fakeData([], async (gameId, options?: KorbReadOptions) => {
      options?.reading?.replaced({
        storedAt: NOW_IN_SPEC - 3 * STUNDE,
        reason: 'unavailable',
      });
      return inTheSportsHall(gameId);
    });
    data.teamGames.mockImplementation(
      async (_team, options?: KorbReadOptions) => {
        options?.reading?.replaced({
          storedAt: NOW_IN_SPEC - STUNDE,
          reason: 'no-internet',
        });
        return season(WASBUETTEL, game(GIFHORN, WASBUETTEL, '2026-11-14'));
      }
    );

    const { page, settled } = await render(data, [WASBUETTEL.id]);
    // the Halle is read once its card is there
    await settled();

    expect(text(part(entries(page)[0], 'as-of'))).toContain(
      'DBB nicht erreichbar · Stand: vor 3 Std.'
    );
  });

  it('labels no card whose Spiele were just read', async () => {
    const { page } = await render(fakeData([season(WASBUETTEL)]), [
      WASBUETTEL.id,
    ]);

    expect(part(entries(page)[0], 'as-of')?.textContent?.trim() ?? '').toBe('');
  });

  it('offers to search a further Team, after the cards, once a Team is followed', async () => {
    const { page } = await render(fakeData([season(WASBUETTEL)]), [
      WASBUETTEL.id,
    ]);

    const links = page.querySelectorAll<HTMLAnchorElement>('a[href="/suchen"]');
    expect([...links].map(text)).toEqual(['Weiteres Team suchen']);
    const [link] = links;
    expect(link.getAttribute('matButton')).toBe('outlined');
    expect(link.classList).toContain('mat-mdc-button-base');
    expect(link.closest('[data-qa="overview-empty"]')).toBeNull();
    const card = entries(page)[0];
    expect(
      card.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('shows the next Spiel with day, time, home or away and opponent', async () => {
    const { page } = await render(
      fakeData([
        season(
          WASBUETTEL,
          game(GIFHORN, WASBUETTEL, '2026-11-14', { time: '15:30' })
        ),
      ]),
      [WASBUETTEL.id]
    );

    const next = part(entries(page)[0], 'next');
    expect(text(next)).toContain('Nächstes Spiel');
    expect(text(next)).toContain('Sa., 14.11.2026');
    expect(text(next)).toContain('15:30 Uhr');
    expect(text(next)).toContain('Auswärts gegen MTV Gifhorn');
  });

  it('shows the last result with the next Spiel', async () => {
    const { page } = await render(
      fakeData([
        season(
          WASBUETTEL,
          game(WASBUETTEL, GIFHORN, '2026-10-17', { status: PLAYED_78_47 }),
          game(OESINGEN, WASBUETTEL, '2026-11-14')
        ),
      ]),
      [WASBUETTEL.id]
    );

    const [entry] = entries(page);
    expect(text(part(entry, 'next'))).toContain('gegen SV Groß Oesingen');
    const last = text(part(entry, 'last'));
    expect(last).toContain('Letztes Ergebnis');
    expect(last).toContain('Heim gegen MTV Gifhorn');
    expect(last).toContain('78:47');
  });

  it('shows only the last result of a Team with no Spiel to come', async () => {
    const { page } = await render(
      fakeData([
        season(
          WASBUETTEL,
          game(WASBUETTEL, GIFHORN, '2026-10-17', { status: PLAYED_78_47 })
        ),
      ]),
      [WASBUETTEL.id]
    );

    const [entry] = entries(page);
    expect(part(entry, 'next')).toBeNull();
    expect(text(part(entry, 'last'))).toContain('78:47');
  });

  it('says so for a Team without Spiele', async () => {
    const { page } = await render(fakeData([season(WASBUETTEL)]), [
      WASBUETTEL.id,
    ]);

    expect(text(entries(page)[0])).toContain(
      'Noch keine Spiele in dieser Saison.'
    );
  });

  it('orders Meine Teams by their next Spiel, Teams with none last', async () => {
    const { page } = await render(
      fakeData([
        season(
          OESINGEN,
          game(OESINGEN, GIFHORN, '2026-10-17', { status: PLAYED_78_47 })
        ),
        season(GIFHORN, game(GIFHORN, OESINGEN, '2026-11-21')),
        season(
          WASBUETTEL,
          game(WASBUETTEL, GIFHORN, '2026-11-14', { time: '16:00' })
        ),
        season(
          WASBUETTEL_U14,
          game(WASBUETTEL_U14, OESINGEN, '2026-11-14', { time: '11:00' })
        ),
      ]),
      [OESINGEN.id, GIFHORN.id, WASBUETTEL.id, WASBUETTEL_U14.id]
    );

    expect(teamNamen(page)).toEqual([
      'MTV Wasbüttel U14',
      'MTV Wasbüttel',
      'MTV Gifhorn',
      'SV Groß Oesingen',
    ]);
  });

  it('shows a cancelled Spiel before the next one as cancelled', async () => {
    const { page } = await render(
      fakeData([
        season(
          WASBUETTEL,
          game(WASBUETTEL, OESINGEN, '2026-11-14', {
            status: { kind: 'cancelled' },
          }),
          game(WASBUETTEL, GIFHORN, '2026-11-21')
        ),
      ]),
      [WASBUETTEL.id]
    );

    const [entry] = entries(page);
    const abgesagt = text(part(entry, 'cancellation'));
    expect(abgesagt).toContain('Fällt aus');
    expect(abgesagt).toContain('abgesagt');
    expect(abgesagt).toContain('Sa., 14.11.2026');
    expect(abgesagt).toContain('gegen SV Groß Oesingen');
    expect(text(part(entry, 'next'))).toContain('gegen MTV Gifhorn');
  });

  it('shows a forfeited Spiel as forfeited, to come or last', async () => {
    const { page } = await render(
      fakeData([
        season(
          WASBUETTEL,
          game(WASBUETTEL, GIFHORN, '2026-10-17', {
            status: {
              kind: 'forfeited',
              forfeitedBy: ['away'],
              result: { home: 20, away: 0 },
            },
          }),
          game(OESINGEN, WASBUETTEL, '2026-11-14', {
            status: { kind: 'forfeited', forfeitedBy: ['home'] },
          })
        ),
      ]),
      [WASBUETTEL.id]
    );

    const [entry] = entries(page);
    expect(part(entry, 'next')).toBeNull();
    expect(text(part(entry, 'cancellation'))).toContain('kampflos');
    expect(text(part(entry, 'last'))).toContain('kampflos');
    expect(text(part(entry, 'last'))).toContain('20:0');
  });

  it('links each Team to its Team page', async () => {
    const { page } = await render(fakeData([season(WASBUETTEL)]), [
      WASBUETTEL.id,
    ]);

    expect(entries(page)[0].querySelector('a')?.getAttribute('href')).toBe(
      '/team/313036'
    );
  });

  it("opens a Spiel's page from its card, the Team link kept", async () => {
    const { page } = await render(
      fakeData([
        season(
          WASBUETTEL,
          game(WASBUETTEL, GIFHORN, '2026-10-17', {
            id: 2861436,
            status: PLAYED_78_47,
          }),
          game(OESINGEN, WASBUETTEL, '2026-11-14', { id: 2861445 })
        ),
      ]),
      [WASBUETTEL.id]
    );

    const [entry] = entries(page);
    const targets = [...entry.querySelectorAll('a[href^="/"]')].map((a) =>
      a.getAttribute('href')
    );
    expect(targets).toEqual([
      '/team/313036',
      '/spiel/2861445',
      '/spiel/2861436',
    ]);
  });

  describe("the next Spiel's Halle", () => {
    it('shows it with a link that opens navigation', async () => {
      const { page, settled } = await render(
        fakeData([season(WASBUETTEL, game(GIFHORN, WASBUETTEL, '2026-11-14'))]),
        [WASBUETTEL.id]
      );
      // the Halle is read once its card is there
      await settled();

      const next = part(entries(page)[0], 'next');
      expect(text(next?.querySelector('[data-qa="venue-name"]'))).toBe(
        'Sporthalle am Wasserturm'
      );
      const navigation = next?.querySelector('[data-qa="venue-navigation"]');
      expect(navigation?.getAttribute('rel')).toBe('noopener');
      expect(navigation?.getAttribute('href')).toBe(
        'https://www.google.com/maps/search/?api=1&query=Sporthalle%20am%20Wasserturm%2C%20Turmweg%201%2C%2038518%20Gifhorn'
      );
    });

    it('reads the Halle of each next Spiel only', async () => {
      const nextWasbuettel = game(WASBUETTEL, GIFHORN, '2026-11-14');
      const nextGifhorn = game(GIFHORN, OESINGEN, '2026-11-21');
      const data = fakeData([
        season(
          WASBUETTEL,
          game(WASBUETTEL, OESINGEN, '2026-10-17', { status: PLAYED_78_47 }),
          nextWasbuettel,
          game(OESINGEN, WASBUETTEL, '2026-11-28')
        ),
        season(GIFHORN, nextGifhorn),
        season(
          OESINGEN,
          game(OESINGEN, GIFHORN, '2026-10-17', { status: PLAYED_78_47 })
        ),
      ]);

      await render(data, [WASBUETTEL.id, GIFHORN.id, OESINGEN.id]);

      expect(data.game.mock.calls.map(([gameId]) => gameId)).toEqual(
        expect.arrayContaining([nextWasbuettel.id, nextGifhorn.id])
      );
      expect(data.game).toHaveBeenCalledTimes(2);
    });

    it("keeps a card and the others when one card's Halle fails", async () => {
      const gifhorns = game(GIFHORN, OESINGEN, '2026-11-21');
      const { page, settled } = await render(
        fakeData(
          [
            season(WASBUETTEL, game(WASBUETTEL, OESINGEN, '2026-11-14')),
            season(GIFHORN, gifhorns),
          ],
          async (gameId) => {
            if (gameId === gifhorns.id) {
              throw new BasketballDataError('unavailable', 'DBB: nope');
            }
            return inTheSportsHall(gameId);
          }
        ),
        [WASBUETTEL.id, GIFHORN.id]
      );
      await settled();

      const [wasbuettel, gifhorn] = entries(page);
      expect(text(wasbuettel.querySelector('[data-qa="venue-name"]'))).toBe(
        'Sporthalle am Wasserturm'
      );
      expect(text(gifhorn.querySelector('[data-qa="venue-error"]'))).toContain(
        'Der DBB ist gerade nicht erreichbar.'
      );
      expect(text(part(gifhorn, 'next'))).toContain('gegen SV Groß Oesingen');
    });
  });

  it('keeps the other Teams when one fails', async () => {
    const { page } = await render(
      fakeData([
        season(WASBUETTEL, game(WASBUETTEL, GIFHORN, '2026-11-14')),
        {
          teamId: GIFHORN.id,
          error: new BasketballDataError('unavailable', 'DBB: nope'),
        },
      ]),
      [GIFHORN.id, WASBUETTEL.id]
    );

    const [wasbuettel, gifhorn] = entries(page);
    expect(text(part(wasbuettel, 'next'))).toContain('gegen MTV Gifhorn');
    expect(text(part(gifhorn, 'error'))).toContain(
      'Der DBB ist gerade nicht erreichbar.'
    );
    expect(gifhorn.querySelector('a')?.getAttribute('href')).toBe(
      '/team/201500'
    );
  });

  describe('each Team on its own', () => {
    const NIE: Promise<TeamSeason> = new Promise(() => undefined);
    const NIE_DETAILS: Promise<GameDetails> = new Promise(() => undefined);

    it('shows a Team while another still loads', async () => {
      const { page } = await render(
        {
          game: inTheSportsHall,
          clubTeams: WITHOUT_TEAMS,
          gameReport: WITHOUT_REPORT,
          teamGames: async (teamId) =>
            teamId === GIFHORN.id
              ? NIE
              : season(WASBUETTEL, game(WASBUETTEL, GIFHORN, '2026-11-14')),
        },
        [GIFHORN.id, WASBUETTEL.id]
      );

      const [wasbuettel, gifhorn] = entries(page);
      expect(text(part(wasbuettel, 'next'))).toContain('gegen MTV Gifhorn');
      expect(gifhorn.querySelector('mat-progress-bar')).not.toBeNull();
    });

    it('reads no other Team again when one is followed or unfollowed', async () => {
      const data = fakeData([
        season(WASBUETTEL, game(WASBUETTEL, GIFHORN, '2026-11-14')),
        season(GIFHORN, game(GIFHORN, OESINGEN, '2026-11-21')),
        season(OESINGEN),
      ]);
      const { page, selection, settled } = await render(data, [
        WASBUETTEL.id,
        OESINGEN.id,
      ]);

      await selection.follow(GIFHORN.id);
      await settled();
      await selection.unfollow(OESINGEN.id);
      await settled();

      expect(teamNamen(page)).toEqual(['MTV Wasbüttel', 'MTV Gifhorn']);
      expect(data.teamGames.mock.calls.map(([teamId]) => teamId)).toEqual([
        WASBUETTEL.id,
        OESINGEN.id,
        GIFHORN.id,
      ]);
    });

    it('cancels the read of a Team unfollowed while it loads', async () => {
      const data = fakeData([]);
      data.teamGames.mockImplementation(() => NIE);
      const { selection, settled } = await render(data, [GIFHORN.id]);
      const reading = data.teamGames.mock.calls[0][1]?.signal;

      await selection.unfollow(GIFHORN.id);
      await settled();

      expect(reading?.aborted).toBe(true);
    });

    it("cancels the next Spiel's Halle read of a Team unfollowed", async () => {
      const data = fakeData(
        [season(GIFHORN, game(GIFHORN, OESINGEN, '2026-11-21'))],
        () => NIE_DETAILS
      );
      const { selection, settled } = await render(data, [GIFHORN.id]);
      await settled();
      const reading = data.game.mock.calls[0][1]?.signal;
      expect(reading?.aborted).toBe(false);

      await selection.unfollow(GIFHORN.id);
      await settled();

      expect(reading?.aborted).toBe(true);
    });

    it("reads no Halle before a Team's next Spiel is known", async () => {
      const data = fakeData([]);
      data.teamGames.mockImplementation(() => NIE);

      await render(data, [GIFHORN.id]);

      expect(data.game).not.toHaveBeenCalled();
    });

    it('puts a Team in its place once it has loaded', async () => {
      let loadGifhorn: (loaded: TeamSeason) => void = () => undefined;
      const { page, settled } = await render(
        {
          game: inTheSportsHall,
          clubTeams: WITHOUT_TEAMS,
          gameReport: WITHOUT_REPORT,
          teamGames: (teamId) =>
            teamId === GIFHORN.id
              ? new Promise((resolve) => (loadGifhorn = resolve))
              : Promise.resolve(
                  season(WASBUETTEL, game(WASBUETTEL, OESINGEN, '2026-11-21'))
                ),
        },
        [WASBUETTEL.id, GIFHORN.id]
      );
      expect(teamNamen(page)[0]).toBe('MTV Wasbüttel');

      loadGifhorn(season(GIFHORN, game(GIFHORN, OESINGEN, '2026-11-14')));
      await settled();

      expect(teamNamen(page)).toEqual(['MTV Gifhorn', 'MTV Wasbüttel']);
    });

    /** The card's control to unfollow its Team. */
    function unfollowButton(entry: Element): HTMLButtonElement | null {
      return entry.querySelector<HTMLButtonElement>(
        '[data-qa="overview-actions"] [data-qa="follow-team"]'
      );
    }

    it('unfollows a Team whose read fails from its card', async () => {
      const { page, selection, settled } = await render(
        fakeData([
          season(WASBUETTEL),
          {
            teamId: GIFHORN.id,
            error: new BasketballDataError('not-found', 'DBB: nope'),
          },
        ]),
        [GIFHORN.id, WASBUETTEL.id]
      );
      const [gifhorn] = entries(page);
      expect(text(part(gifhorn, 'name'))).toBe('Team 201500');
      const button = unfollowButton(gifhorn);
      expect(button?.getAttribute('aria-label')).toBe(
        'Nicht mehr folgen: Team 201500'
      );

      button?.click();
      await settled();

      expect(selection.teams()).toEqual([WASBUETTEL.id]);
      expect(teamNamen(page)).toEqual(['MTV Wasbüttel']);
    });

    it('unfollows a Team that loaded from its card, offering to undo it', async () => {
      const { page, selection, settled, bars } = await render(
        fakeData([season(WASBUETTEL), season(GIFHORN)]),
        [WASBUETTEL.id, GIFHORN.id]
      );
      await settled();
      const [wasbuettel] = entries(page);
      const button = unfollowButton(wasbuettel);
      expect(button?.getAttribute('aria-label')).toBe(
        'Nicht mehr folgen: MTV Wasbüttel'
      );

      button?.click();
      await settled();

      expect(selection.teams()).toEqual([GIFHORN.id]);
      expect(teamNamen(page)).toEqual(['MTV Gifhorn']);
      // focus stays on the overview, not on the page's body
      expect(document.activeElement?.textContent?.trim()).toBe('Meine Teams');
      const bar = await bars.getHarness(MatSnackBarHarness);
      expect(await bar.getMessage()).toBe(
        'MTV Wasbüttel steht nicht mehr in Meine Teams.'
      );

      await bar.dismissWithAction();
      await settled();

      expect(selection.teams()).toEqual([GIFHORN.id, WASBUETTEL.id]);
      TestBed.inject(MatSnackBar).dismiss();
    });
  });

  describe('the end of the Saison', () => {
    /** Wasbüttel's Verein: the Team itself and its U14. */
    const WASBUETTELS_CLUB: ClubTeams = {
      club: { id: WASBUETTEL.clubId, name: 'MTV Wasbüttel' },
      teams: [
        { team: WASBUETTEL, leagues: [VORRUNDE] },
        {
          team: WASBUETTEL_U14,
          leagues: [{ ...VORRUNDE, id: 54900, name: 'U14 Regionsliga' }],
        },
      ],
    };

    function withLastGameOn(datum: string) {
      return fakeData(
        [
          season(
            WASBUETTEL,
            game(WASBUETTEL, GIFHORN, datum, { status: PLAYED_78_47 })
          ),
        ],
        inTheSportsHall,
        async () => WASBUETTELS_CLUB
      );
    }

    it("says no Spiel is set for a Team and suggests its Verein's current Teams", async () => {
      // more than two weeks before 8 November
      const data = withLastGameOn('2026-10-17');

      const { page, settled } = await render(data, [WASBUETTEL.id]);
      // the Verein is read once its card is there
      await settled();

      const hint = part(entries(page)[0], 'season-over');
      expect(text(hint)).toContain('Keine Spiele mehr angesetzt.');
      expect(data.clubTeams).toHaveBeenCalledWith(
        WASBUETTEL.clubId,
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
      expect(
        [...(hint?.querySelectorAll('[data-qa="club-team-name"]') ?? [])].map(
          (name) => text(name)
        )
      ).toEqual(['MTV Wasbüttel U14']);
      expect(text(part(entries(page)[0], 'last'))).toContain('78:47');
    });

    it('reads a Verein once for two of its Teams whose Saison looks over', async () => {
      const u14: Team = { ...WASBUETTEL_U14, clubId: WASBUETTEL.clubId };
      const data = fakeData(
        [
          season(
            WASBUETTEL,
            game(WASBUETTEL, GIFHORN, '2026-10-17', { status: PLAYED_78_47 })
          ),
          season(
            u14,
            game(u14, OESINGEN, '2026-10-10', { status: PLAYED_78_47 })
          ),
        ],
        inTheSportsHall,
        async () => WASBUETTELS_CLUB
      );

      const { page, settled } = await render(data, [WASBUETTEL.id, u14.id]);
      await settled();

      expect(data.clubTeams).toHaveBeenCalledTimes(1);
      const suggestions = entries(page).map((entry) =>
        [
          ...(part(entry, 'season-over')?.querySelectorAll(
            '[data-qa="club-team-name"]'
          ) ?? []),
        ].map((name) => text(name))
      );
      expect(suggestions).toEqual([['MTV Wasbüttel U14'], ['MTV Wasbüttel']]);
    });

    it('follows a suggested Team from the card', async () => {
      const { page, selection, settled } = await render(
        withLastGameOn('2026-10-17'),
        [WASBUETTEL.id]
      );
      await settled();

      part(entries(page)[0], 'season-over')
        ?.querySelector<HTMLButtonElement>('[data-qa="follow-team"]')
        ?.click();
      await settled();

      expect(selection.teams()).toEqual([WASBUETTEL.id, WASBUETTEL_U14.id]);
    });

    it('unfollows a suggested Team from the card, focus left on its control, no undo', async () => {
      const { page, selection, settled, bars } = await render(
        withLastGameOn('2026-10-17'),
        [WASBUETTEL.id]
      );
      await settled();
      const button = () =>
        part(entries(page)[0], 'season-over')?.querySelector<HTMLButtonElement>(
          '[data-qa="follow-team"]'
        );
      button()?.click();
      await settled();
      button()?.focus();

      button()?.click();
      await settled();

      expect(selection.teams()).toEqual([WASBUETTEL.id]);
      expect(document.activeElement).toBe(button());
      expect(await bars.getHarnessOrNull(MatSnackBarHarness)).toBeNull();
    });

    it('says nothing and reads no Verein exactly two weeks after the last Spiel', async () => {
      const data = withLastGameOn('2026-10-25');

      const { page } = await render(data, [WASBUETTEL.id]);

      expect(part(entries(page)[0], 'season-over')).toBeNull();
      expect(data.clubTeams).not.toHaveBeenCalled();
    });

    it('says nothing for a Team without Spiele', async () => {
      const data = fakeData([season(WASBUETTEL)]);

      const { page } = await render(data, [WASBUETTEL.id]);

      expect(part(entries(page)[0], 'season-over')).toBeNull();
      expect(data.clubTeams).not.toHaveBeenCalled();
    });

    it('keeps the card when the Verein cannot be read', async () => {
      const { page, settled } = await render(
        fakeData(
          [
            season(
              WASBUETTEL,
              game(WASBUETTEL, GIFHORN, '2026-10-17', {
                status: PLAYED_78_47,
              })
            ),
          ],
          inTheSportsHall,
          async () => {
            throw new BasketballDataError('unavailable', 'DBB: nope');
          }
        ),
        [WASBUETTEL.id]
      );
      await settled();

      const [entry] = entries(page);
      expect(text(part(entry, 'last'))).toContain('78:47');
      expect(
        text(entry.querySelector('[data-qa="club-teams-error"]'))
      ).toContain('Der DBB ist gerade nicht erreichbar.');
    });
  });

  describe('the Kinder', () => {
    function benannt(personId: number, firstName: string): NamedPlayer {
      return {
        kind: 'named',
        personId,
        firstName,
        lastName: 'Ahornwiese',
      };
    }

    const LUMI = benannt(4711, 'Lumi');
    const MORVO = benannt(4712, 'Morvo');
    const NELKA = benannt(4713, 'Nelka');

    /**
     * Spielberichte by Spiel: the home Kader as given, an Anonymer Spieler
     * and a player of the other Team on the away side.
     */
    function reports(
      homeRoster: Readonly<Record<number, readonly NamedPlayer[]>>,
      awayRoster: Readonly<Record<number, readonly NamedPlayer[]>> = {}
    ): ReportRead {
      return async (gameId): Promise<GameReport | undefined> => {
        const home = homeRoster[gameId];
        const away = awayRoster[gameId];
        if (home === undefined && away === undefined) {
          return undefined;
        }
        return {
          gameId,
          home: {
            playerStatsRecorded: false,
            entries: [...(home ?? []), { kind: 'anonymous' }],
          },
          away: { playerStatsRecorded: false, entries: [...(away ?? [])] },
        };
      };
    }

    async function withChildren(
      teams: readonly TeamId[],
      children: readonly (readonly [NamedPlayer, string?])[]
    ): Promise<LocalSelection> {
      const selection = await following(teams);
      for (const [player, spitzname] of children) {
        await selection.mark(player, spitzname);
      }
      return selection;
    }

    function childSections(page: HTMLElement): HTMLElement[] {
      return [
        ...page.querySelectorAll<HTMLElement>('[data-qa="overview-child"]'),
      ];
    }

    function childNames(page: HTMLElement): (string | undefined)[] {
      return childSections(page).map((section) =>
        text(part(section, 'child-name'))
      );
    }

    const PLAYED_ON = (datum: string) =>
      ({ status: PLAYED_78_47, time: '10:00', date: datum }) as const;

    it('groups the overview by Kind, with the Teams it plays for, and lists the others below', async () => {
      const letztesWas = game(WASBUETTEL, GIFHORN, '2026-11-01', {
        status: PLAYED_78_47,
      });
      const lastOesingen = game(OESINGEN, GIFHORN, '2026-11-01', {
        status: PLAYED_78_47,
      });
      const data = fakeData(
        [
          season(
            WASBUETTEL,
            letztesWas,
            game(WASBUETTEL, OESINGEN, '2026-11-21')
          ),
          season(OESINGEN, lastOesingen, game(OESINGEN, GIFHORN, '2026-11-14')),
        ],
        inTheSportsHall,
        WITHOUT_TEAMS,
        reports({ [letztesWas.id]: [LUMI], [lastOesingen.id]: [NELKA] })
      );

      const { page } = await render(
        data,
        await withChildren([WASBUETTEL.id, OESINGEN.id], [[LUMI, 'Lu']])
      );

      const [lumi] = childSections(page);
      expect(childNames(page)).toEqual(['Lu']);
      expect(text(part(lumi, 'child-teams'))).toBe('MTV Wasbüttel');
      expect(text(part(lumi, 'next'))).toContain('Sa., 21.11.2026');
      // one Team: no need to name it again
      expect(text(part(lumi, 'next'))).not.toContain('Nächstes Spiel ·');
      expect(text(part(lumi, 'last'))).toContain('78:47');
      expect(text(part(lumi, 'roster'))).toBe('check_circle Im Kader');
      expect(text(page.querySelector('[data-qa="overview-others"]'))).toBe(
        'Weitere Teams'
      );
      expect(teamNamen(page)).toEqual(['SV Groß Oesingen']);
    });

    it('offers to search a further Team after the Kind, where every Team is its', async () => {
      const letztesWas = game(WASBUETTEL, GIFHORN, '2026-11-01', {
        status: PLAYED_78_47,
      });
      const data = fakeData(
        [season(WASBUETTEL, letztesWas)],
        inTheSportsHall,
        WITHOUT_TEAMS,
        reports({ [letztesWas.id]: [LUMI] })
      );

      const { page } = await render(
        data,
        await withChildren([WASBUETTEL.id], [[LUMI, 'Lu']])
      );

      expect(teamNamen(page)).toEqual([]);
      const [lumi] = childSections(page);
      const links =
        page.querySelectorAll<HTMLAnchorElement>('a[href="/suchen"]');
      expect([...links].map(text)).toEqual(['Weiteres Team suchen']);
      expect(
        lumi.compareDocumentPosition(links[0]) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    });

    it("unfollows a Kind's Team from its card, focus on the overview", async () => {
      const letztesWas = game(WASBUETTEL, GIFHORN, '2026-11-01', {
        status: PLAYED_78_47,
      });
      const data = fakeData(
        [season(WASBUETTEL, letztesWas), season(OESINGEN)],
        inTheSportsHall,
        WITHOUT_TEAMS,
        reports({ [letztesWas.id]: [LUMI] })
      );
      const { page, selection, settled } = await render(
        data,
        await withChildren([WASBUETTEL.id, OESINGEN.id], [[LUMI, 'Lu']])
      );
      const [lumi] = childSections(page);
      const buttons = [
        ...lumi.querySelectorAll<HTMLButtonElement>(
          '[data-qa="overview-child-actions"] [data-qa="follow-team"]'
        ),
      ];
      expect(
        buttons.map((button) => button.getAttribute('aria-label'))
      ).toEqual(['Nicht mehr folgen: MTV Wasbüttel']);

      buttons[0].click();
      await settled();

      expect(selection.teams()).toEqual([OESINGEN.id]);
      expect(document.activeElement?.textContent?.trim()).toBe('Meine Teams');
      TestBed.inject(MatSnackBar).dismiss();
    });

    it('shows the same Kind once across two Teams, with the first next Spiel of both', async () => {
      const letztesU12 = game(WASBUETTEL, GIFHORN, '2026-10-31', {
        status: PLAYED_78_47,
      });
      const letztesU14 = game(WASBUETTEL_U14, GIFHORN, '2026-11-07', {
        status: PLAYED_78_47,
      });
      const data = fakeData(
        [
          season(
            WASBUETTEL,
            letztesU12,
            game(WASBUETTEL, GIFHORN, '2026-11-21')
          ),
          season(
            WASBUETTEL_U14,
            letztesU14,
            game(WASBUETTEL_U14, OESINGEN, '2026-11-14')
          ),
        ],
        inTheSportsHall,
        WITHOUT_TEAMS,
        reports({ [letztesU12.id]: [LUMI], [letztesU14.id]: [LUMI] })
      );

      const { page } = await render(
        data,
        await withChildren([WASBUETTEL.id, WASBUETTEL_U14.id], [[LUMI]])
      );

      expect(childSections(page)).toHaveLength(1);
      const [lumi] = childSections(page);
      // no Spitzname: the first name its Kader gives, read fresh
      expect(text(part(lumi, 'child-name'))).toBe('Lumi');
      expect(text(part(lumi, 'child-teams'))).toBe(
        'MTV Wasbüttel · MTV Wasbüttel U14'
      );
      // each Team's "Nicht mehr folgen" beside its name, for all to see
      expect(
        [...lumi.querySelectorAll('[data-qa="overview-child-action"]')].map(
          (aktion) => [
            text(aktion.querySelector('.team-name')),
            aktion
              .querySelector('[data-qa="follow-team"]')
              ?.getAttribute('aria-label'),
          ]
        )
      ).toEqual([
        ['MTV Wasbüttel', 'Nicht mehr folgen: MTV Wasbüttel'],
        ['MTV Wasbüttel U14', 'Nicht mehr folgen: MTV Wasbüttel U14'],
      ]);
      expect(text(part(lumi, 'next'))).toContain('Sa., 14.11.2026');
      expect(text(part(lumi, 'next'))).toContain('SV Groß Oesingen');
      // which of its Teams plays
      expect(text(part(lumi, 'next'))).toContain(
        'Nächstes Spiel · MTV Wasbüttel U14'
      );
      expect(text(part(lumi, 'last'))).toContain('Sa., 07.11.2026');
      expect(text(part(lumi, 'last'))).toContain(
        'Letztes Ergebnis · MTV Wasbüttel U14'
      );
      expect(teamNamen(page)).toEqual([]);
      expect(page.querySelector('[data-qa="overview-others"]')).toBeNull();
    });

    it('orders the Kinder by their next Spiel, a Kind without one last', async () => {
      const played = [WASBUETTEL, GIFHORN, OESINGEN].map((von) =>
        game(von, WASBUETTEL_U14, '2026-11-01', { status: PLAYED_78_47 })
      );
      const data = fakeData(
        [
          season(
            WASBUETTEL,
            played[0],
            game(WASBUETTEL, OESINGEN, '2026-11-28')
          ),
          season(GIFHORN, played[1], game(GIFHORN, OESINGEN, '2026-11-14')),
          season(OESINGEN, played[2]),
        ],
        inTheSportsHall,
        WITHOUT_TEAMS,
        reports({
          [played[0].id]: [LUMI],
          [played[1].id]: [MORVO],
          [played[2].id]: [NELKA],
        })
      );

      const { page } = await render(
        data,
        await withChildren(
          [WASBUETTEL.id, GIFHORN.id, OESINGEN.id],
          [[NELKA], [LUMI], [MORVO]]
        )
      );

      expect(childNames(page)).toEqual(['Morvo', 'Lumi', 'Nelka']);
    });

    it('says when the Kind was not on the Kader of the last Spiel', async () => {
      const previous = game(WASBUETTEL, GIFHORN, '2026-10-25', {
        status: PLAYED_78_47,
      });
      const zuletzt = game(WASBUETTEL, OESINGEN, '2026-11-01', {
        status: PLAYED_78_47,
      });
      const data = fakeData(
        [season(WASBUETTEL, previous, zuletzt)],
        inTheSportsHall,
        WITHOUT_TEAMS,
        reports({ [previous.id]: [LUMI], [zuletzt.id]: [MORVO] })
      );

      const { page } = await render(
        data,
        await withChildren([WASBUETTEL.id], [[LUMI]])
      );

      const [lumi] = childSections(page);
      expect(text(part(lumi, 'last'))).toContain('SV Groß Oesingen');
      expect(text(part(lumi, 'roster'))).toBe(
        'remove_circle_outline Nicht im Kader'
      );
    });

    it('reads only the last Spielbericht where it names every Kind', async () => {
      const played = ['2026-10-18', '2026-10-25', '2026-11-01'].map((datum) =>
        game(WASBUETTEL, GIFHORN, datum, { status: PLAYED_78_47 })
      );
      const data = fakeData(
        [season(WASBUETTEL, ...played)],
        inTheSportsHall,
        WITHOUT_TEAMS,
        reports(Object.fromEntries(played.map(({ id }) => [id, [LUMI]])))
      );

      await render(data, await withChildren([WASBUETTEL.id], [[LUMI]]));

      expect(data.gameReport.mock.calls.map(([id]) => id)).toEqual([
        played[2].id,
      ]);
    });

    it("never looks into the opponent's Kader for a Kind", async () => {
      const played = game(WASBUETTEL, GIFHORN, '2026-11-01', {
        status: PLAYED_78_47,
      });
      const data = fakeData(
        [season(WASBUETTEL, played)],
        inTheSportsHall,
        WITHOUT_TEAMS,
        reports({ [played.id]: [] }, { [played.id]: [LUMI] })
      );

      const { page } = await render(
        data,
        await withChildren([WASBUETTEL.id], [[LUMI, 'Lu']])
      );

      const [lumi] = childSections(page);
      expect(text(part(lumi, 'child-missing'))).toContain(
        'In den letzten Spielberichten deiner Teams steht dieses Kind nicht.'
      );
      expect(teamNamen(page)).toEqual(['MTV Wasbüttel']);
    });

    it('puts a Team among the others once the Kind missed its last 5 played Spiele', async () => {
      const played = [
        '2026-10-04',
        '2026-10-11',
        '2026-10-18',
        '2026-10-25',
        '2026-11-01',
        '2026-11-07',
      ].map((datum) => game(WASBUETTEL, GIFHORN, datum, PLAYED_ON(datum)));
      // the Kind played only in the oldest, the sixth Spiel back
      const data = fakeData(
        [season(WASBUETTEL, ...played)],
        inTheSportsHall,
        WITHOUT_TEAMS,
        reports(
          Object.fromEntries(
            played.map(({ id }, i) => [id, i === 0 ? [LUMI] : [MORVO]])
          )
        )
      );

      const { page } = await render(
        data,
        await withChildren([WASBUETTEL.id], [[LUMI]])
      );

      expect(data.gameReport).toHaveBeenCalledTimes(5);
      expect(data.gameReport).not.toHaveBeenCalledWith(
        played[0].id,
        expect.anything()
      );
      expect(childNames(page)).toEqual(['Mein Kind']);
      expect(teamNamen(page)).toEqual(['MTV Wasbüttel']);
    });

    it('finds the Kind in the fifth played Spiel back', async () => {
      const played = [
        '2026-10-11',
        '2026-10-18',
        '2026-10-25',
        '2026-11-01',
        '2026-11-07',
      ].map((datum) => game(WASBUETTEL, GIFHORN, datum, PLAYED_ON(datum)));
      const data = fakeData(
        [season(WASBUETTEL, ...played)],
        inTheSportsHall,
        WITHOUT_TEAMS,
        reports(
          Object.fromEntries(
            played.map(({ id }, i) => [id, i === 0 ? [LUMI] : [MORVO]])
          )
        )
      );

      const { page } = await render(
        data,
        await withChildren([WASBUETTEL.id], [[LUMI]])
      );

      const [lumi] = childSections(page);
      expect(text(part(lumi, 'child-teams'))).toBe('MTV Wasbüttel');
      // played that Spiel, but not the last one
      expect(text(part(lumi, 'roster'))).toContain('Nicht im Kader');
    });

    it("says the Spielberichte can't be read where the search failed, and lists the Team below", async () => {
      const played = game(WASBUETTEL, GIFHORN, '2026-11-01', {
        status: PLAYED_78_47,
      });
      const data = fakeData(
        [season(WASBUETTEL, played)],
        inTheSportsHall,
        WITHOUT_TEAMS,
        async () => {
          throw new BasketballDataError('offline', 'no network');
        }
      );

      const { page } = await render(
        data,
        await withChildren([WASBUETTEL.id], [[LUMI, 'Lu']])
      );

      const [lumi] = childSections(page);
      expect(text(part(lumi, 'child-missing'))).toBe(
        'Die Spiele deiner Teams lassen sich gerade nicht alle lesen.'
      );
      expect(teamNamen(page)).toEqual(['MTV Wasbüttel']);
    });

    it('lists a Team among the others while its Kader is still read', async () => {
      const played = game(WASBUETTEL, GIFHORN, '2026-11-01', {
        status: PLAYED_78_47,
      });
      const data = fakeData(
        [season(WASBUETTEL, played)],
        inTheSportsHall,
        WITHOUT_TEAMS,
        () => NEVER_REPORT
      );

      const { page } = await render(
        data,
        await withChildren([WASBUETTEL.id], [[LUMI, 'Lu']])
      );

      const [lumi] = childSections(page);
      expect(lumi.querySelector('mat-progress-bar')).not.toBeNull();
      expect(part(lumi, 'child-missing')).toBeNull();
      expect(teamNamen(page)).toEqual(['MTV Wasbüttel']);
    });

    it("ends the search of a Team whose Saison can't be read, the Kind's card saying why", async () => {
      const played = game(WASBUETTEL, GIFHORN, '2026-11-01', {
        status: PLAYED_78_47,
      });
      const data = fakeData(
        [
          season(WASBUETTEL, played),
          {
            teamId: OESINGEN.id,
            error: new BasketballDataError('offline', ''),
          },
        ],
        inTheSportsHall,
        WITHOUT_TEAMS,
        reports({ [played.id]: [MORVO] })
      );

      const { page } = await render(
        data,
        await withChildren([WASBUETTEL.id, OESINGEN.id], [[LUMI, 'Lu']])
      );

      const [lumi] = childSections(page);
      expect(lumi.querySelector('mat-progress-bar')).toBeNull();
      expect(text(part(lumi, 'child-missing'))).toBe(
        'Die Spiele deiner Teams lassen sich gerade nicht alle lesen.'
      );
      expect(entries(page)).toHaveLength(2);
    });

    describe('a change to the Kinder', () => {
      const PLAYED_GAME = game(WASBUETTEL, GIFHORN, '2026-11-01', {
        status: PLAYED_78_47,
      });

      async function withLumiFound() {
        const data = fakeData(
          [season(WASBUETTEL, PLAYED_GAME)],
          inTheSportsHall,
          WITHOUT_TEAMS,
          reports({ [PLAYED_GAME.id]: [LUMI, MORVO] })
        );
        const gerendert = await render(
          data,
          await withChildren([WASBUETTEL.id], [[LUMI, 'Lu']])
        );
        return { data, ...gerendert };
      }

      function showsLumi(page: HTMLElement): void {
        const [lumi] = childSections(page);
        expect(text(part(lumi, 'child-name'))).toBe('Lu');
        expect(text(part(lumi, 'child-teams'))).toBe('MTV Wasbüttel');
        expect(text(part(lumi, 'roster'))).toContain('Im Kader');
      }

      it('keeps what was found while a Kind marked anew is looked for', async () => {
        const { data, page, selection, settled } = await withLumiFound();
        data.gameReport.mockImplementation(() => NEVER_REPORT);

        await selection.mark(MORVO);
        await settled();

        showsLumi(page);
        expect(childNames(page)).toEqual(['Lu', MY_CHILD]);
        expect(teamNamen(page)).toEqual([]);
      });

      it('keeps what was found where a search run again fails as a whole', async () => {
        const { data, page, selection, settled } = await withLumiFound();
        // a Kader without entries breaks the search off as a whole
        data.gameReport.mockResolvedValue({
          gameId: PLAYED_GAME.id,
          home: {},
          away: {},
        } as unknown as GameReport);

        await selection.mark(MORVO);
        await settled();

        showsLumi(page);
        expect(teamNamen(page)).toEqual([]);
      });

      it('reads nothing again when a Kind is unmarked', async () => {
        const { data, page, selection, settled } = await withLumiFound();
        await selection.mark(MORVO);
        await settled();
        const read = data.gameReport.mock.calls.length;

        await selection.unmark(MORVO.personId);
        await settled();

        expect(data.gameReport).toHaveBeenCalledTimes(read);
        showsLumi(page);
        expect(childSections(page)).toHaveLength(1);
      });
    });

    it("says a Kind's Teams may be more where another Team's Spielberichte can't be read", async () => {
      const read = game(WASBUETTEL, GIFHORN, '2026-11-01', {
        status: PLAYED_78_47,
      });
      const fehlt = game(OESINGEN, GIFHORN, '2026-11-01', {
        status: PLAYED_78_47,
      });
      const finden = reports({ [read.id]: [LUMI] });
      const data = fakeData(
        [season(WASBUETTEL, read), season(OESINGEN, fehlt)],
        inTheSportsHall,
        WITHOUT_TEAMS,
        async (gameId, options) => {
          if (gameId === fehlt.id) {
            throw new BasketballDataError('unavailable', 'DBB down');
          }
          return finden(gameId, options);
        }
      );

      const { page } = await render(
        data,
        await withChildren([WASBUETTEL.id, OESINGEN.id], [[LUMI, 'Lu']])
      );

      const [lumi] = childSections(page);
      expect(text(part(lumi, 'child-teams'))).toBe('MTV Wasbüttel');
      expect(text(part(lumi, 'child-incomplete'))).toBe(VIELLEICHT_MEHR);
    });

    it("says a Kind's Teams may be more where another Team's Saison can't be read", async () => {
      const read = game(WASBUETTEL, GIFHORN, '2026-11-01', {
        status: PLAYED_78_47,
      });
      const data = fakeData(
        [
          season(WASBUETTEL, read),
          {
            teamId: OESINGEN.id,
            error: new BasketballDataError('offline', ''),
          },
        ],
        inTheSportsHall,
        WITHOUT_TEAMS,
        reports({ [read.id]: [LUMI] })
      );

      const { page } = await render(
        data,
        await withChildren([WASBUETTEL.id, OESINGEN.id], [[LUMI, 'Lu']])
      );

      expect(text(part(childSections(page)[0], 'child-incomplete'))).toBe(
        VIELLEICHT_MEHR
      );
    });

    it('shows what falls through around the next Spiel in tip-off order', async () => {
      const played = [WASBUETTEL, WASBUETTEL_U14].map((von) =>
        game(von, GIFHORN, '2026-11-01', { status: PLAYED_78_47 })
      );
      const earlierOff = game(WASBUETTEL_U14, OESINGEN, '2026-11-14', {
        status: { kind: 'cancelled' },
      });
      const next = game(WASBUETTEL, OESINGEN, '2026-11-21');
      const laterOff = game(WASBUETTEL_U14, OESINGEN, '2026-11-28', {
        status: { kind: 'cancelled' },
      });
      const data = fakeData(
        [
          season(WASBUETTEL, played[0], next),
          season(
            WASBUETTEL_U14,
            played[1],
            earlierOff,
            laterOff,
            game(WASBUETTEL_U14, OESINGEN, '2026-12-05')
          ),
        ],
        inTheSportsHall,
        WITHOUT_TEAMS,
        reports({ [played[0].id]: [LUMI], [played[1].id]: [LUMI] })
      );

      const { page } = await render(
        data,
        await withChildren([WASBUETTEL.id, WASBUETTEL_U14.id], [[LUMI]])
      );

      const parts = [
        ...childSections(page)[0].querySelectorAll(
          '[data-qa="overview-cancellation"], [data-qa="overview-next"]'
        ),
      ].map((element) => [
        element.getAttribute('data-qa'),
        text(element.querySelector('[data-qa="game-date"]')),
      ]);
      expect(parts).toEqual([
        ['overview-cancellation', 'Sa., 14.11.2026'],
        ['overview-next', 'Sa., 21.11.2026'],
        ['overview-cancellation', 'Sa., 28.11.2026'],
      ]);
    });

    it('says nothing of more Teams where every Spielbericht was read', async () => {
      const read = game(WASBUETTEL, GIFHORN, '2026-11-01', {
        status: PLAYED_78_47,
      });
      const { page } = await render(
        fakeData(
          [season(WASBUETTEL, read)],
          inTheSportsHall,
          WITHOUT_TEAMS,
          reports({ [read.id]: [LUMI] })
        ),
        await withChildren([WASBUETTEL.id], [[LUMI, 'Lu']])
      );

      expect(part(childSections(page)[0], 'child-incomplete')).toBeNull();
    });

    it('reads no Spielbericht while no Kind is marked', async () => {
      const data = fakeData([
        season(
          WASBUETTEL,
          game(WASBUETTEL, GIFHORN, '2026-11-01', { status: PLAYED_78_47 })
        ),
      ]);

      await render(data, [WASBUETTEL.id]);

      expect(data.gameReport).not.toHaveBeenCalled();
    });

    it('starts the search once a Kind is marked, and groups the Team under it', async () => {
      const played = game(WASBUETTEL, GIFHORN, '2026-11-01', {
        status: PLAYED_78_47,
      });
      const data = fakeData(
        [season(WASBUETTEL, played)],
        inTheSportsHall,
        WITHOUT_TEAMS,
        reports({ [played.id]: [LUMI] })
      );
      const { page, selection, settled } = await render(data, [WASBUETTEL.id]);

      await selection.mark(LUMI, 'Lu');
      await settled();

      expect(childNames(page)).toEqual(['Lu']);
      expect(teamNamen(page)).toEqual([]);
    });

    describe('while no Kind is marked', () => {
      function hint(page: HTMLElement): string | undefined {
        return text(page.querySelector('[data-qa="overview-hint"]'));
      }

      it('explains that a Kind can be marked after its first Spiel, while no Team has played', async () => {
        const { page } = await render(
          fakeData([
            season(WASBUETTEL, game(WASBUETTEL, GIFHORN, '2026-11-14')),
          ]),
          [WASBUETTEL.id]
        );

        expect(hint(page)).toBe(
          'Dein Kind kannst du markieren, sobald es nach seinem ersten Spiel in einem Spielbericht steht. Öffne dann das Spiel und markiere es im Kader.'
        );
        expect(teamNamen(page)).toEqual(['MTV Wasbüttel']);
      });

      it('asks to open a played Spiel once a Team has played', async () => {
        const { page } = await render(
          fakeData([
            season(WASBUETTEL, game(WASBUETTEL, GIFHORN, '2026-11-14')),
            season(
              GIFHORN,
              game(GIFHORN, OESINGEN, '2026-11-01', { status: PLAYED_78_47 })
            ),
          ]),
          [WASBUETTEL.id, GIFHORN.id]
        );

        expect(hint(page)).toBe(
          'Öffne ein gespieltes Spiel, um dein Kind im Kader zu markieren, sobald sein Spielbericht da ist.'
        );
      });

      it('says neither while no Team is followed', async () => {
        const { page } = await render(fakeData([]), []);
        expect(hint(page)).toBeUndefined();
      });

      it('says neither once a Kind is marked', async () => {
        const { page } = await render(
          fakeData([
            season(WASBUETTEL, game(WASBUETTEL, GIFHORN, '2026-11-14')),
          ]),
          await withChildren([WASBUETTEL.id], [[LUMI]])
        );

        expect(hint(page)).toBeUndefined();
      });
    });
  });
});
