import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  BasketballDataError,
  DbbBasketballData,
} from '@wolsok/feat-shared-basketball-data';
import { LocalSelection } from '@wolsok/feat-korbjaeger-selection';
import { SELECTION } from '../selection/selection';
import {
  BASKETBALL_DATA,
  type KorbjaegerData,
} from '../basketball-data/basketball-data.provider';
import { NOW } from '../now';
import { recordedDbbTransport } from '@wolsok/feat-shared-basketball-data/testing';
import { seasonOf, gameOn, WASBUETTEL_RST } from '../../testing/team-season';
import { ChildStepComponent } from './child-step.component';

type TeamGamesRead = KorbjaegerData['teamGames'];
type GameRead = KorbjaegerData['game'];

const RECORDED = new DbbBasketballData(recordedDbbTransport);

/** A recorded Spiel of a Liga with Spielberichte (`statisticType` 1). */
const GAME_WITH_REPORTS = 2861436;
/** A recorded Spiel of a Liga without Spielberichte (`statisticType` 0). */
const GAME_WITHOUT_REPORTS = 2930311;

/**
 * The Spiel asked for, in the Liga of the recorded Spiel `recorded` as its
 * details name it: the fixtures hold no Team of such a Liga.
 */
function inLeagueOf(recorded: number): GameRead {
  return async (game, options) => {
    const details = await RECORDED.game(recorded, options);
    return { ...details, game: { ...details.game, id: game } };
  };
}

const NOW_IN_SPEC = Date.parse('2026-11-08T12:00:00+01:00');
const WASBUETTEL = WASBUETTEL_RST;

/** A Spiel the DBB does not know, so its Liga stays unknown. */
const unknownGame: GameRead = async () => {
  throw new BasketballDataError('not-found', 'no such Spiel');
};

async function render(
  read: TeamGamesRead,
  {
    followed = true,
    game = unknownGame,
  }: { followed?: boolean; game?: GameRead } = {}
): Promise<{
  page: HTMLElement;
  teamGames: ReturnType<typeof vi.fn<TeamGamesRead>>;
}> {
  const teamGames = vi.fn<TeamGamesRead>(read);
  // in memory: nothing reaches the device's storage
  const selection = new LocalSelection(undefined);
  if (followed) {
    await selection.follow(WASBUETTEL.id);
  }
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: BASKETBALL_DATA, useValue: { teamGames, game } },
      { provide: SELECTION, useValue: selection },
      { provide: NOW, useValue: signal(NOW_IN_SPEC) },
    ],
  });
  const fixture = TestBed.createComponent(ChildStepComponent);
  fixture.componentRef.setInput('teamId', WASBUETTEL.id);
  fixture.componentRef.setInput('teamName', WASBUETTEL.name);
  await fixture.whenStable();
  return { page: fixture.nativeElement as HTMLElement, teamGames };
}

function text(element: Element | null | undefined): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

describe('ChildStepComponent', () => {
  it("links a followed Team's last played Spiel, to mark the Kind there", async () => {
    const { page, teamGames } = await render(async () =>
      seasonOf(
        gameOn(2861436, '2026-09-20'),
        gameOn(2861440, '2026-10-04'),
        gameOn(2861450, '2026-11-15', { kind: 'scheduled' })
      )
    );

    expect(teamGames).toHaveBeenCalledWith(WASBUETTEL.id, expect.anything());
    const link = page.querySelector('[data-qa="child-step-mark"]');
    expect(link?.getAttribute('href')).toBe('/spiel/2861440');
    expect(link?.getAttribute('aria-label')).toBe(
      'Kind im Kader markieren: MTV Wasbüttel -RST-'
    );
  });

  it('says the Kind can be marked after its first Spiel where none was played', async () => {
    const { page } = await render(async () =>
      seasonOf(gameOn(2861450, '2026-11-15', { kind: 'scheduled' }))
    );

    expect(page.querySelector('[data-qa="child-step-mark"]')).toBeNull();
    expect(
      text(page.querySelector('[data-qa="child-step-after-first-game"]'))
    ).toBe(
      'Dein Kind kannst du markieren, sobald es nach seinem ersten Spiel in einem Spielbericht steht.'
    );
  });

  describe('on the recorded DBB answers', () => {
    // Team 313036's recorded Spiele, whose Ligen never say whether they
    // keep Spielberichte (`statisticType` null), as the DBB answers them.
    const recordedSeason: TeamGamesRead = (team, options) =>
      RECORDED.teamGames(team, options);

    it("knows nothing of the Liga's Spielberichte from the Team's Spiele", async () => {
      const season = await RECORDED.teamGames(WASBUETTEL.id);

      expect(season.leagues.some((league) => league.withoutGameReports)).toBe(
        false
      );
    });

    it("says the Kind cannot be marked where the Spiel's details name a Liga without Spielberichte", async () => {
      const { page } = await render(recordedSeason, {
        game: inLeagueOf(GAME_WITHOUT_REPORTS),
      });

      expect(page.querySelector('[data-qa="child-step-mark"]')).toBeNull();
      expect(
        text(page.querySelector('[data-qa="child-step-no-game-reports"]'))
      ).toBe(
        'Für die Liga dieses Teams führt der DBB keine Spielberichte. Dein Kind kannst du hier deshalb nicht markieren.'
      );
    });

    it('links the last played Spiel where its Liga keeps Spielberichte', async () => {
      const game = vi.fn<GameRead>(inLeagueOf(GAME_WITH_REPORTS));
      const { page } = await render(recordedSeason, { game });

      expect(game).toHaveBeenCalledWith(2861445, expect.anything());
      expect(
        page.querySelector('[data-qa="child-step-mark"]')?.getAttribute('href')
      ).toBe('/spiel/2861445');
    });
  });

  it('links the Spiel where its details could not be read', async () => {
    const { page } = await render(
      async () => seasonOf(gameOn(2861436, '2026-09-20')),
      {
        game: async () => {
          throw new BasketballDataError('unavailable', 'DBB down');
        },
      }
    );

    expect(
      page.querySelector('[data-qa="child-step-mark"]')?.getAttribute('href')
    ).toBe('/spiel/2861436');
  });

  it('says how old the Spiele are where the last good answer stood in', async () => {
    const { page } = await render(async (_, options) => {
      options?.reading?.replaced({
        storedAt: NOW_IN_SPEC - 2 * 60 * 60_000,
        reason: 'no-connection',
      });
      return seasonOf(gameOn(2861436, '2026-09-20'));
    });

    expect(text(page.querySelector('[data-qa="child-step-as-of"]'))).toContain(
      'Stand: vor 2 Std.'
    );
    expect(
      page.querySelector('[data-qa="child-step-mark"]')?.getAttribute('href')
    ).toBe('/spiel/2861436');
  });

  it('says why the Spiele could not be read', async () => {
    const { page } = await render(async () => {
      throw new BasketballDataError('unavailable', 'DBB down');
    });

    expect(text(page.querySelector('[data-qa="child-step-failure"]'))).toBe(
      'Der DBB ist gerade nicht erreichbar. Bitte später noch einmal versuchen.'
    );
  });

  it('shows and reads nothing for a Team not followed', async () => {
    const { page, teamGames } = await render(async () => seasonOf(), {
      followed: false,
    });

    expect(teamGames).not.toHaveBeenCalled();
    expect(text(page)).toBe('');
  });
});
