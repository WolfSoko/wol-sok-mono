import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameStateStore } from '../state/game.states';
import { LEVELS } from '../state/levels';
import { MatchEarnings } from '../state/earnings';
import { MatchRecord, MedalAward } from '../state/medallions';
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
      inputs: { steers: [], drags: [], boosts: [] },
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

    it('is no offer between two players or without a run', () => {
      store.update({ mode: 'two-players', lastReplay: run });
      expect(ghostButton()).toBeUndefined();

      store.update({ mode: 'vs-computer', lastReplay: null });
      expect(ghostButton()).toBeUndefined();
    });

    it('tells who won against the ghost, and offers it again', () => {
      store.update({
        mode: 'vs-computer',
        winner: createPlayer({ id: 1, name: 'Ghost', isBot: true }),
        levelId: LEVELS[0].id,
        lastReplay: run,
        ghost: run,
      });

      expect(text()).toContain('Your ghost wins');
      expect(text()).toContain('Fight it again');
      expect(ghostButton()).toBeUndefined();

      store.update({ winner: createPlayer({ id: 0, name: 'You' }) });
      expect(text()).toContain('You beat your ghost');
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
    const win: MatchRecord = {
      levelId: 'hourglass',
      difficulty: 'normal',
      won: true,
      durationSec: 59.6,
      boostsFired: 0,
      lost: 0,
      peakCount: 500,
      lowestSizeRatio: 1,
      captured: 0,
      enemyCrushed: 0,
      peakShare: 0,
    };

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
});
