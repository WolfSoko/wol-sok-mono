import { I18nService } from '../i18n/i18n.service';
import { aMatchRecord } from '../../testing/match-record';
import { Clipboard } from '@angular/cdk/clipboard';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameStateStore } from '../state/game.states';
import { LEVELS } from '../state/levels';
import { MatchEarnings } from '../state/earnings';
import { MedalAward } from '../state/medallions';
import { createPlayer } from '../state/player.model';
import { WinnerComponent } from './winner.component';

describe('WinnerComponent', () => {
  let fixture: ComponentFixture<WinnerComponent>;
  let store: GameStateStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WinnerComponent],
    }).compileComponents();

    store = TestBed.inject(GameStateStore);
    fixture = TestBed.createComponent(WinnerComponent);
  });

  /** What a match earned: only the given parts, nothing else. */
  function earnings(changes: Partial<MatchEarnings>): MatchEarnings {
    return {
      award: null,
      achievements: [],
      xp: { parts: [], total: 0 },
      xpBefore: 0,
      unlocked: [],
      cosmetics: [],
      ...changes,
    };
  }

  function text(): string {
    fixture.detectChanges();
    return fixture.nativeElement.textContent as string;
  }

  it('says which ranked attempt the match was', () => {
    store.update({
      mode: 'vs-computer',
      winner: createPlayer({ id: 0, name: 'You' }),
      levelId: LEVELS[0].id,
      ranked: { match: null, note: { kind: 'daily', n: 2 } },
    });

    expect(text()).toContain('Ranked attempt 2 of 3 · ranked setup');
  });

  it('says the match of a ranked run, and why one was not ranked', () => {
    store.update({
      mode: 'vs-computer',
      winner: createPlayer({ id: 0, name: 'You' }),
      levelId: LEVELS[0].id,
      ranked: { match: null, note: { kind: 'endless', match: 4 } },
    });
    expect(text()).toContain('Ranked run · match 4');

    store.update({
      ranked: { match: null, note: { kind: 'unranked', reason: 'offline' } },
    });
    expect(text()).toContain('Not ranked: offline when the match started');

    TestBed.inject(I18nService).setLanguage('de');
    store.update({
      ranked: {
        match: null,
        note: { kind: 'unranked', reason: 'run-dropped' },
      },
    });
    expect(text()).toContain('Dieser Lauf wird nicht mehr gewertet');
    TestBed.inject(I18nService).setLanguage('en');
  });

  it('names the winner', () => {
    store.update({
      mode: 'two-players',
      winner: createPlayer({ id: 1, name: 'Blue' }),
      levelId: LEVELS[0].id,
    });

    expect(text()).toContain('Blue wins');
  });

  it('congratulates the human who beat the computer', () => {
    store.update({
      mode: 'vs-computer',
      winner: createPlayer({ id: 0, name: 'You' }),
      levelId: LEVELS[0].id,
    });

    expect(text()).toContain('You win');
  });

  it('tells the human that the computer won', () => {
    store.update({
      mode: 'vs-computer',
      winner: createPlayer({ id: 1, name: 'Computer', isBot: true }),
      levelId: LEVELS[0].id,
    });

    expect(text()).toContain('The computer wins');
  });

  it('calls a match without a winner a draw', () => {
    store.update({ winner: null, levelId: LEVELS[0].id });

    expect(text()).toContain('draw');
  });

  it('tells that the clock ended the match, and who was bigger', () => {
    store.update({
      mode: 'vs-computer',
      winner: createPlayer({ id: 0, name: 'You' }),
      endedBy: 'time',
      levelId: LEVELS[0].id,
    });

    expect(text()).toContain('Time is up - your colony is the bigger one');
  });

  it('frames a boss level as the chapter finale', () => {
    store.update({
      mode: 'vs-computer',
      winner: createPlayer({ id: 0, name: 'You' }),
      endedBy: 'survive',
      levelId: 'meltdown',
    });

    expect(text()).toContain('You survived the boss');
  });

  it('tells who held the zone long enough', () => {
    store.update({
      mode: 'vs-computer',
      winner: createPlayer({ id: 1, name: 'Computer', isBot: true }),
      endedBy: 'hold',
      levelId: LEVELS[0].id,
    });

    expect(text()).toContain('The computer held the zone');
  });

  it('calls a timed match between equal colonies a draw', () => {
    store.update({ winner: null, endedBy: 'time', levelId: LEVELS[0].id });

    expect(text()).toContain('the same size. A draw');
  });

  it('offers the level that comes next', () => {
    store.update({ winner: null, levelId: LEVELS[0].id });

    expect(text()).toContain(LEVELS[1].name);
  });

  it('has nothing to offer after the last level', () => {
    store.update({ winner: null, levelId: LEVELS[LEVELS.length - 1].id });

    expect(text()).not.toContain('Next:');
  });

  it('lists the achievements the match earned', () => {
    store.update({
      winner: null,
      levelId: LEVELS[0].id,
      earnings: earnings({ achievements: ['blitz', 'pacifist'] }),
    });
    fixture.detectChanges();

    const names = Array.from(
      fixture.nativeElement.querySelectorAll('.chip-name') as Element[]
    ).map((name) => name.textContent?.trim());
    expect(names).toEqual(['Blitz', 'Pacifist']);
  });

  it('adds up the XP and shows the way to the next rank', () => {
    store.update({
      winner: null,
      levelId: LEVELS[0].id,
      earnings: earnings({
        xp: {
          parts: [
            { label: 'Win · Normal', xp: 125 },
            { label: 'Achievement', xp: 50 },
          ],
          total: 175,
        },
        xpBefore: 100,
      }),
    });

    expect(text()).toContain('+175 XP');
    expect(text()).toContain('Win · Normal 125');
    expect(text()).toContain('Coccus');
    expect(text()).toContain('Rank up!');
    expect(text()).toContain('475 XP to Bacillus');
  });

  it('leaves the rank out where what was held before is not known', () => {
    store.update({
      winner: null,
      levelId: LEVELS[0].id,
      earnings: earnings({
        xp: { parts: [{ label: 'Win · Normal', xp: 125 }], total: 125 },
        xpBefore: null,
      }),
    });

    expect(text()).toContain('+125 XP');
    expect(fixture.nativeElement.querySelector('.xp-bar')).toBeNull();
    expect(text()).not.toContain('Rank up!');
  });

  it('shows the series and the rivalry between two players', () => {
    store.update({
      mode: 'two-players',
      colors: ['orange', 'blue'],
      winner: createPlayer({ id: 0, name: 'Orange' }),
      levelId: LEVELS[0].id,
      series: { bestOf: 3, wins: [2, 1] },
      earnings: earnings({}),
    });

    expect(text()).toContain('Orange 2 : 1 Blue');
    expect(text()).toContain('Orange takes the series!');
    expect(text()).toContain('Rivalry');
  });

  it('leaves the series and the rivalry out against the computer', () => {
    store.update({
      mode: 'vs-computer',
      winner: null,
      levelId: LEVELS[0].id,
      earnings: earnings({}),
    });

    expect(text()).not.toContain('Rivalry');
  });

  it('names the cosmetics the match opened', () => {
    store.update({
      winner: null,
      levelId: LEVELS[0].id,
      earnings: earnings({ cosmetics: ['Green colonies'] }),
    });

    expect(text()).toContain('Green colonies');
  });

  it('names the levels the match opened', () => {
    store.update({
      winner: null,
      levelId: LEVELS[0].id,
      earnings: earnings({ unlocked: [LEVELS[1].id] }),
    });

    expect(text()).toContain('Unlocked');
    expect(text()).toContain(LEVELS[1].name);
  });

  it('locks the next level until the ladder opens it', () => {
    store.update({ winner: null, levelId: LEVELS[0].id });
    fixture.componentRef.setInput('upcomingLock', 'Win Petri Dish to unlock');
    fixture.detectChanges();

    const next = Array.from(
      fixture.nativeElement.querySelectorAll('button') as HTMLButtonElement[]
    ).find((b) => b.textContent?.includes('Next:'));
    expect(next?.disabled).toBe(true);
    expect(text()).toContain('Win Petri Dish to unlock');
  });

  it('leaves Choose a level out where there is no level choice', () => {
    store.update({ winner: null, levelId: LEVELS[0].id });
    expect(text()).toContain('Choose a level');

    fixture.componentRef.setInput('canChooseLevel', false);

    expect(text()).not.toContain('Choose a level');
  });

  describe('the ghost', () => {
    /** A run to fight, as the end of a match against the computer leaves it. */
    const run = {
      header: {
        levelId: LEVELS[0].id,
        mode: 'vs-computer' as const,
        difficulty: 'normal' as const,
        colors: ['orange', 'blue'] as [string, string],
        headStart: 0 as const,
        width: 320,
        height: 140,
        seed: 1,
        version: 1,
        balanceVersion: 1,
        simulation: 'cpu' as const,
        ticks: 600,
      },
      inputs: { steers: [], drags: [], boosts: [], weapons: [] },
    };

    function ghostButton(): HTMLButtonElement | undefined {
      fixture.detectChanges();
      return Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll('button')
      ).find((button) => button.textContent?.includes('Fight your ghost'));
    }

    it('offers to fight the run just played against the computer', () => {
      store.update({
        mode: 'vs-computer',
        winner: createPlayer({ id: 0, name: 'You' }),
        levelId: LEVELS[0].id,
        lastReplay: run,
      });
      const picked = jest.fn();
      fixture.componentInstance.action.subscribe(picked);

      ghostButton()?.click();

      expect(picked).toHaveBeenCalledWith('ghost');
    });

    it('is no offer after a match between two players or without a run', () => {
      store.update({
        mode: 'two-players',
        lastReplay: { ...run, header: { ...run.header, mode: 'two-players' } },
      });
      expect(ghostButton()).toBeUndefined();

      store.update({ mode: 'vs-computer', lastReplay: null });
      expect(ghostButton()).toBeUndefined();
    });

    describe('sharing', () => {
      const navigator = window.navigator as Navigator & { share?: unknown };

      afterEach(() => {
        delete navigator.share;
      });

      function shareButton(): HTMLButtonElement | undefined {
        fixture.detectChanges();
        return Array.from(
          (fixture.nativeElement as HTMLElement).querySelectorAll('button')
        ).find((button) => button.textContent?.includes('Share your run'));
      }

      async function settle(): Promise<void> {
        for (let turn = 0; turn < 20; turn++) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      /** Shows the result and lets the link to the run be made. */
      async function ready(): Promise<void> {
        fixture.detectChanges();
        await settle();
        fixture.detectChanges();
      }

      beforeEach(() => {
        store.update({
          mode: 'vs-computer',
          winner: createPlayer({ id: 0, name: 'You' }),
          levelId: LEVELS[0].id,
          lastReplay: run,
        });
      });

      it('copies a link to the run where there is no share sheet', async () => {
        const copy = jest
          .spyOn(TestBed.inject(Clipboard), 'copy')
          .mockReturnValue(true);

        await ready();
        shareButton()?.click();
        await settle();

        expect(copy).toHaveBeenCalledWith(
          expect.stringMatching(/#ghost=[\w-]+$/)
        );
        expect(text()).toContain('Link copied');
      });

      it('hands the link to the share sheet where there is one', async () => {
        const share = jest.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'share', {
          configurable: true,
          value: share,
        });

        await ready();
        shareButton()?.click();
        await settle();

        expect(share).toHaveBeenCalledWith(
          expect.objectContaining({
            url: expect.stringContaining('#ghost='),
            text: expect.stringContaining(LEVELS[0].name),
          })
        );
      });

      it('takes a closed share sheet for no failure', async () => {
        Object.defineProperty(navigator, 'share', {
          configurable: true,
          value: jest
            .fn()
            .mockRejectedValue(new DOMException('closed', 'AbortError')),
        });

        await ready();
        shareButton()?.click();
        await settle();

        expect(text()).not.toContain('could not be shared');
      });
    });

    it('tells who won against the ghost, and offers it again', () => {
      store.update({
        mode: 'vs-computer',
        winner: createPlayer({ id: 1, name: 'Ghost', isBot: true }),
        levelId: LEVELS[0].id,
        lastReplay: run,
        ghost: run,
      });

      expect(text()).toContain('The ghost wins');
      expect(text()).toContain('Fight it again');
      expect(ghostButton()).toBeUndefined();

      store.update({ winner: createPlayer({ id: 0, name: 'You' }) });
      expect(text()).toContain('You beat the ghost');
    });
  });

  it('tells the attempt and the streak of the daily level', () => {
    store.update({
      mode: 'vs-computer',
      winner: createPlayer({ id: 0, name: 'You' }),
      levelId: LEVELS[0].id,
      earnings: earnings({
        daily: { attempt: 2, streak: 5 },
      }),
    });
    expect(text()).toContain('Daily level · attempt 2 of 3 · 5-day streak');

    store.update({
      earnings: earnings({ daily: { attempt: 4, streak: 5 } }),
    });
    expect(text()).toContain('Daily level · practice');
  });

  describe('in an endless run', () => {
    function endlessButton(): HTMLButtonElement | undefined {
      fixture.detectChanges();
      return Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll('button')
      ).find(
        (button) =>
          button.querySelector('mat-icon')?.textContent === 'all_inclusive'
      );
    }

    it('tells the depth and the lives, and leads on to the next level', () => {
      store.update({
        mode: 'vs-computer',
        winner: createPlayer({ id: 0, name: 'You', isBot: false }),
        levelId: LEVELS[0].id,
        endless: { seed: 1, wins: 3, lives: 2 },
        endlessMatch: true,
      });
      const picked = jest.fn();
      fixture.componentInstance.action.subscribe(picked);

      expect(text()).toContain('Endless run · 3 levels beaten · 2 lives left');
      expect(endlessButton()?.textContent).toContain('Next level');
      expect(text()).not.toContain('Play again');
      endlessButton()?.click();
      expect(picked).toHaveBeenCalledWith('endless');
    });

    it('shows no run after a match that was none of it', () => {
      store.update({
        mode: 'vs-computer',
        winner: createPlayer({ id: 0, name: 'You', isBot: false }),
        levelId: LEVELS[0].id,
        endless: { seed: 1, wins: 3, lives: 2 },
        endlessMatch: false,
      });

      expect(text()).not.toContain('Endless run');
      expect(text()).toContain('Play again');
    });

    it('offers the same level again after a defeat, a new run at the end', () => {
      store.update({
        mode: 'vs-computer',
        winner: createPlayer({ id: 1, name: 'Computer', isBot: true }),
        levelId: LEVELS[0].id,
        endless: { seed: 1, wins: 3, lives: 1 },
        endlessMatch: true,
      });
      expect(endlessButton()?.textContent).toContain('Try it again');

      store.update({ endless: { seed: 1, wins: 3, lives: 0 } });
      expect(text()).toContain('Endless run over · 3 levels beaten');
      expect(endlessButton()?.textContent).toContain('New run');
    });
  });

  describe('in the training', () => {
    function buttons(): HTMLButtonElement[] {
      fixture.detectChanges();
      return Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll('button')
      );
    }

    it('tells the mission done and leads on to the next one', () => {
      store.update({
        mode: 'vs-computer',
        winner: createPlayer({ id: 0, name: 'You' }),
        endedBy: 'hold',
        matchLevel: 'training-steer',
        earnings: earnings({
          training: {
            shortfall: null,
            first: true,
            allDone: false,
            next: 'feed',
          },
        }),
      });
      const picked = jest.fn();
      fixture.componentInstance.action.subscribe(picked);

      expect(text()).toContain('Mission complete!');
      expect(text()).not.toContain('Fight your ghost');
      const labels = buttons().map((button) => button.textContent ?? '');
      expect(labels.some((label) => label.includes('All missions'))).toBe(true);
      buttons()
        .find((button) => button.textContent?.includes('Next mission'))
        ?.click();
      expect(picked).toHaveBeenCalledWith('mission');
    });

    it('tells what the match fell short of, and offers it again', () => {
      store.update({
        mode: 'vs-computer',
        winner: createPlayer({ id: 0, name: 'You' }),
        endedBy: 'harvest',
        matchLevel: 'training-boost',
        earnings: earnings({
          training: {
            shortfall: {
              key: 'training.result.boosts',
              params: { count: 2, fired: 1 },
            },
            first: false,
            allDone: false,
            next: null,
          },
        }),
      });

      expect(text()).toContain(
        'Not yet - boost 2 times on the way, you boosted 1'
      );
      expect(text()).toContain('Try it again');
      expect(text()).not.toContain('Next mission');
    });

    /** The fight won, as the result shows it once it is recorded. */
    function fightWon(): void {
      store.update({
        mode: 'vs-computer',
        winner: createPlayer({ id: 0, name: 'You' }),
        endedBy: 'time',
        matchLevel: 'training-fight',
        earnings: earnings({
          training: {
            shortfall: null,
            first: true,
            allDone: false,
            next: 'steer',
          },
        }),
      });
    }

    it('leads on to a mission still to do after the last one, taken first', () => {
      fightWon();

      expect(text()).not.toContain('Training complete');
      expect(text()).toContain('Next mission');
    });

    it('leads on to the campaign once every mission is done', () => {
      store.update({
        mode: 'vs-computer',
        winner: createPlayer({ id: 0, name: 'You' }),
        endedBy: 'time',
        matchLevel: 'training-fight',
        earnings: earnings({
          training: { shortfall: null, first: true, allDone: true, next: null },
        }),
      });
      const picked = jest.fn();
      fixture.componentInstance.action.subscribe(picked);

      expect(text()).toContain('Training complete');
      expect(text()).not.toContain('Next mission');
      buttons()
        .find((button) => button.textContent?.includes('To the campaign'))
        ?.click();
      expect(picked).toHaveBeenCalledWith('campaign');
    });
  });

  it('reports what the player picks', () => {
    store.update({ winner: null, levelId: LEVELS[0].id });
    const picked = jest.fn();
    fixture.componentInstance.action.subscribe(picked);
    fixture.detectChanges();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button') as HTMLButtonElement[]
    );
    buttons.find((b) => b.textContent?.includes('Play again'))?.click();
    buttons.find((b) => b.textContent?.includes('Next:'))?.click();
    buttons.find((b) => b.textContent?.includes('Main menu'))?.click();

    expect(picked.mock.calls.map(([action]) => action)).toEqual([
      'again',
      'next',
      'menu',
    ]);
  });

  describe('medallion', () => {
    const win = aMatchRecord({
      levelId: 'hourglass',
      durationSec: 59.6,
      peakCount: 500,
    });

    function award(changes: Partial<MedalAward>): MedalAward {
      return {
        record: win,
        medal: 'silver',
        previousBest: null,
        hint: 'Gold needs a win 20 s faster.',
        ...changes,
      };
    }

    beforeEach(() =>
      store.update({
        mode: 'vs-computer',
        winner: createPlayer({ id: 0, name: 'You' }),
        levelId: 'hourglass',
      })
    );

    it('shows nothing without an award', () => {
      expect(text()).not.toContain('medallion');
      expect(fixture.nativeElement.querySelector('.award')).toBeNull();
    });

    it('shows the medallion the match earned and what the next one needs', () => {
      store.update({ earnings: earnings({ award: award({}) }) });

      expect(text()).toContain('Silver medallion - a new best!');
      expect(text()).toContain('Gold needs a win 20 s faster.');
      expect(
        fixture.nativeElement
          .querySelector('feat-lazy-bac-game-medallion')
          .getAttribute('aria-label')
      ).toBe('Silver medallion, Normal');
    });

    it('floors the match time to the second, as the match clock does', () => {
      store.update({ earnings: earnings({ award: award({}) }) });

      expect(text()).toContain('Won in 0:59');
    });

    it('reminds the player of a better medallion held already', () => {
      store.update({
        earnings: earnings({
          award: award({ medal: 'bronze', previousBest: 'gold' }),
        }),
      });

      expect(text()).toContain('Bronze medallion');
      expect(text()).not.toContain('new best');
      expect(text()).toContain('You hold Gold on this level already.');
    });

    it('calls an equal medallion no new best', () => {
      store.update({
        earnings: earnings({ award: award({ previousBest: 'silver' }) }),
      });

      expect(text()).not.toContain('new best');
      expect(text()).not.toContain('You hold');
    });

    it('has no medallion for a lost match', () => {
      store.update({
        earnings: earnings({
          award: award({
            record: { ...win, won: false },
            medal: null,
            hint: 'Bronze needs a win.',
          }),
        }),
      });

      expect(text()).toContain('No medallion this time');
      expect(text()).toContain('Bronze needs a win.');
      expect(text()).not.toContain('Won in');
    });
  });

  it('speaks German', () => {
    TestBed.inject(I18nService).setLanguage('de');
    store.update({
      mode: 'two-players',
      winner: createPlayer({ id: 1, name: 'Blue' }),
      levelId: LEVELS[0].id,
    });

    expect(text()).toContain('Glückwunsch! Blau gewinnt das Match!');
    expect(text()).toContain('Hauptmenü');
  });
});
