import { TestBed } from '@angular/core/testing';
import { I18nService } from '../i18n/i18n.service';
import { ArenaStage } from '../stage/arena-stage';
import { GameStateService } from '../state/game-state.service';
import { GameStateStore } from '../state/game.states';
import { HudState } from './hud-state';

describe('HudState', () => {
  let hud: HudState;
  let store: GameStateStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [ArenaStage, HudState] });
    hud = TestBed.inject(HudState);
    store = TestBed.inject(GameStateStore);
  });

  it('names the difficulty next to the level', () => {
    TestBed.inject(GameStateService).setDifficulty('hard');

    expect(hud.difficultyName()).toBe('Hard');
  });

  it('speaks German once the player picks it', () => {
    TestBed.inject(GameStateService).setDifficulty('hard');
    expect(hud.clockLabel()).toBe('Game time');

    TestBed.inject(I18nService).setLanguage('de');

    expect(hud.clockLabel()).toBe('Spielzeit');
    expect(hud.difficultyName()).toBe('Schwer');
  });

  it('tells the time played on a level without a time limit', () => {
    expect(hud.clockLabel()).toBe('Game time');
    expect(hud.clockText()).toBe('0:00');
    expect(hud.timeRunningOut()).toBe(false);
  });

  describe('online', () => {
    it('lets only the host restart', () => {
      store.update({
        online: {
          seat: 1,
          levelId: store.snapshot().levelId,
          colors: ['orange', 'blue'],
        },
      });
      expect(hud.onlineSeat()).toBe(1);
      expect(hud.canRestart()).toBe(false);

      store.update({
        online: {
          seat: 0,
          levelId: store.snapshot().levelId,
          colors: ['orange', 'blue'],
        },
      });
      expect(hud.canRestart()).toBe(true);
    });
  });
});
