import { TestBed } from '@angular/core/testing';
import { GameStateService } from '../state/game-state.service';
import { GameStateStore } from '../state/game.states';
import { MatchSetup } from './match-setup';

describe('MatchSetup', () => {
  let setup: MatchSetup;
  let store: GameStateStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [MatchSetup] });
    setup = TestBed.inject(MatchSetup);
    store = TestBed.inject(GameStateStore);
  });

  describe('the colony colours', () => {
    it('keeps a colour still to earn from either seat, also by a swap', () => {
      const gameState = TestBed.inject(GameStateService);
      gameState.setMode('two-players');
      // Settings from before the lock: the right seat plays green.
      gameState.setColors(['orange', 'green']);

      setup.selectColor({ seat: 0, colorId: 'green' });
      expect(store.snapshot().colors).toEqual(['orange', 'green']);

      setup.selectColor({ seat: 1, colorId: 'orange' });
      expect(store.snapshot().colors).toEqual(['orange', 'green']);

      setup.selectColor({ seat: 1, colorId: 'blue' });
      expect(store.snapshot().colors).toEqual(['orange', 'blue']);
    });
  });
});
