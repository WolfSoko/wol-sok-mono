import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProgressService } from '../progress.service';
import { GameStateStore } from '../state/game.states';
import { getLevel, LEVELS } from '../state/levels';
import { MatchRecord } from '../state/medallions';
import { createPlayer } from '../state/player.model';
import { formatDuration, WinnerComponent } from './winner.component';

describe('WinnerComponent', () => {
  let fixture: ComponentFixture<WinnerComponent>;
  let store: GameStateStore;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [WinnerComponent],
    }).compileComponents();

    store = TestBed.inject(GameStateStore);
    fixture = TestBed.createComponent(WinnerComponent);
  });

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
    const limits = getLevel('hourglass').medal;
    const win: MatchRecord = {
      levelId: 'hourglass',
      difficulty: 'normal',
      won: true,
      durationSec: limits.silverSec,
      boostsFired: 0,
      lost: 0,
      peakCount: 500,
      lowestSizeRatio: 1,
    };

    beforeEach(() =>
      store.update({
        mode: 'vs-computer',
        winner: createPlayer({ id: 0, name: 'You' }),
        levelId: 'hourglass',
      })
    );

    it('shows nothing before a match against the computer was judged', () => {
      expect(text()).not.toContain('medallion');
      expect(fixture.nativeElement.querySelector('.award')).toBeNull();
    });

    it('shows the medallion the match earned and what the next one needs', () => {
      TestBed.inject(ProgressService).recordMatch(win);

      expect(text()).toContain('Silver medallion - a new best!');
      expect(text()).toContain(`Won in ${formatDuration(limits.silverSec)}`);
      expect(text()).toContain('Gold needs a win');
      expect(
        fixture.nativeElement
          .querySelector('feat-lazy-bac-game-medallion')
          .getAttribute('aria-label')
      ).toBe('Silver medallion');
    });

    it('reminds the player of a better medallion held already', () => {
      const progress = TestBed.inject(ProgressService);
      progress.recordMatch({
        ...win,
        durationSec: limits.goldSec,
        boostsFired: 1,
      });
      progress.recordMatch({ ...win, durationSec: limits.silverSec + 5 });

      expect(text()).toContain('Bronze medallion');
      expect(text()).not.toContain('new best');
      expect(text()).toContain('You hold Gold on this level already.');
    });

    it('has no medallion for a lost match', () => {
      TestBed.inject(ProgressService).recordMatch({ ...win, won: false });

      expect(text()).toContain('No medallion this time');
      expect(text()).toContain('Bronze needs a win.');
      expect(text()).not.toContain('Won in');
    });
  });
});

describe('formatDuration', () => {
  it('writes minutes and padded seconds', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(59.6)).toBe('1:00');
    expect(formatDuration(125)).toBe('2:05');
  });
});
