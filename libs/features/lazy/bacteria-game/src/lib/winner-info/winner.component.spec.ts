import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameStateStore } from '../state/game.states';
import { LEVELS } from '../state/levels';
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
});
