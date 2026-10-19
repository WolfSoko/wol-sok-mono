import { TestBed } from '@angular/core/testing';
import { GameState, GameStateStore } from './game.states';

describe('GameStateStore.select$', () => {
  let store: GameStateStore;

  beforeEach(() => {
    store = TestBed.inject(GameStateStore);
  });

  it('emits now, then synchronously on every change of the value', () => {
    const states: GameState[] = [];
    const subscription = store
      .select$(() => store.currentState())
      .subscribe((state) => states.push(state));

    store.update({ currentState: GameState.RUNNING });
    expect(states).toEqual([GameState.START, GameState.RUNNING]);
    // Another key changing is no new value.
    store.update({ fps: 60 });
    store.update({ currentState: GameState.PAUSED });
    expect(states).toEqual([
      GameState.START,
      GameState.RUNNING,
      GameState.PAUSED,
    ]);

    subscription.unsubscribe();
    store.update({ currentState: GameState.END });
    expect(states).toHaveLength(3);
  });

  it('never hands a later subscriber an older state than an earlier one wrote', () => {
    // The first subscriber answers a match start with a change of its own,
    // as the settings answer the start screen.
    const first = store
      .select$(() => store.currentState())
      .subscribe((state) => {
        if (state === GameState.RUNNING) {
          store.update({ levelId: 'serpentine' });
        }
      });
    const levels: string[] = [];
    const second = store
      .select$(() => store.levelId())
      .subscribe((levelId) => levels.push(levelId));
    const initial = levels[0];

    store.update({ currentState: GameState.RUNNING });

    expect(levels).toEqual([initial, 'serpentine']);
    first.unsubscribe();
    second.unsubscribe();
  });
});
