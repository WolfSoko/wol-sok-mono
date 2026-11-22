import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LEVELS } from '@wolsok/feat-shared-bacteria-engine';
import type { AnimationState, WsThanosDirective } from '@wolsok/thanos';
import { EMPTY, Observable, Subject } from 'rxjs';
import { keyEvent } from '../../testing/fullscreen-stubs';
import { GameHapticsService } from '../haptics.service';
import { HudState } from '../hud/hud-state';
import { GameSettingsService } from '../settings.service';
import { GameSoundService } from '../sound/game-sound.service';
import { StageInput } from '../stage/stage-input';
import { GameStateService } from '../state/game-state.service';
import { STAGE_PROVIDERS } from '../stage-providers';
import { ArenaStage } from '../stage/arena-stage';
import { GameState, GameStateStore } from '../state/game.states';
import { MatchEnd } from './match-end';
import { PlayFlow } from './play-flow';

describe('MatchEnd', () => {
  let matchEnd: MatchEnd;
  let flow: PlayFlow;
  let store: GameStateStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: STAGE_PROVIDERS });
    matchEnd = TestBed.inject(MatchEnd);
    flow = TestBed.inject(PlayFlow);
    store = TestBed.inject(GameStateStore);
    jest.spyOn(TestBed.inject(ArenaStage), 'vaporize').mockReturnValue(EMPTY);
  });

  it('starts the next match once the arena is clear', () => {
    const start = jest
      .spyOn(flow, 'startGame')
      .mockImplementation(() => undefined);

    matchEnd.onMatchEnd('again');

    expect(start).toHaveBeenCalledTimes(1);
  });

  it('leaves a match be that an online start began as the arena cleared', () => {
    const start = jest
      .spyOn(flow, 'startGame')
      .mockImplementation(() => undefined);
    // The online start waiting for the clear arena plays first.
    flow.arenaCleared$.subscribe(() =>
      store.update({ currentState: GameState.RUNNING })
    );

    matchEnd.onMatchEnd('again');

    expect(start).not.toHaveBeenCalled();
  });
});

/**
 * The end of a match turns the arena to dust first; its result shows only
 * once the dust settled, and the way on plays no second effect.
 */
describe('MatchEnd: the dust before the result', () => {
  let flow: PlayFlow;
  let store: GameStateStore;
  let gameState: GameStateService;
  let vaporized: Subject<AnimationState>;
  let runs: jest.Mock;

  /** Binds the stage to a host without a template, but for its effect. */
  function bindEffect(vaporize$: () => Observable<AnimationState>): void {
    TestBed.inject(ArenaStage).bind({
      arenaView: signal(undefined),
      ambienceCanvas: signal(undefined),
      minimapCanvas: signal(undefined),
      arenaFrame: () => undefined,
      thanos: () => ({ vaporize$ }) as unknown as WsThanosDirective,
      declaring: signal(false),
    });
  }

  /** Starts a match against the computer. */
  function matchOn(): void {
    gameState.setArenaSize(320, 140);
    gameState.setMode('vs-computer');
    gameState.start();
  }

  /** Ends the match as the game does, and lets the stage react to it. */
  function endMatch(): void {
    store.update({ currentState: GameState.END, endedBy: 'annihilation' });
    TestBed.tick();
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: STAGE_PROVIDERS });
    TestBed.inject(MatchEnd);
    flow = TestBed.inject(PlayFlow);
    store = TestBed.inject(GameStateStore);
    gameState = TestBed.inject(GameStateService);
    vaporized = new Subject<AnimationState>();
    runs = jest.fn(() => vaporized);
    bindEffect(runs);
    matchOn();
  });

  it('shows the result only once the arena turned to dust', () => {
    endMatch();

    expect(runs).toHaveBeenCalledTimes(1);
    expect(flow.dissolving()).toBe(true);
    expect(flow.panel()).toBeNull();

    vaporized.complete();

    expect(flow.dissolving()).toBe(false);
    expect(flow.panel()).toBe('over');
  });

  it('plays the end of the match as the dust starts to blow', () => {
    const sound = jest.spyOn(TestBed.inject(GameSoundService), 'matchEnd');
    const buzz = jest.spyOn(TestBed.inject(GameHapticsService), 'matchEnd');

    endMatch();

    expect(sound).toHaveBeenCalledTimes(1);
    expect(buzz).toHaveBeenCalledTimes(1);
    expect(flow.panel()).toBeNull();
  });

  it.each(['again', 'menu', 'watch'] as const)(
    'goes on with %s at once, without a second effect',
    (action) => {
      endMatch();
      vaporized.complete();

      TestBed.inject(MatchEnd).onMatchEnd(action);

      expect(runs).toHaveBeenCalledTimes(1);
      expect(flow.resetting()).toBe(false);
    }
  );

  it('switches to the next level once the old arena is dust', () => {
    const hud = TestBed.inject(HudState);
    jest.spyOn(hud, 'upcomingLevel').mockReturnValue(LEVELS[1]);
    jest.spyOn(hud, 'upcomingLock').mockReturnValue(null);
    jest.spyOn(flow, 'startGame').mockImplementation(() => undefined);
    endMatch();
    vaporized.complete();

    TestBed.inject(MatchEnd).onMatchEnd('next');

    expect(store.snapshot().levelId).toBe(LEVELS[1].id);
    expect(runs).toHaveBeenCalledTimes(1);
  });

  it('lets a reset begun while the dust still blows wait for it', () => {
    endMatch();
    const done = jest.fn();

    flow.resetGame$().subscribe({ complete: done });
    expect(done).not.toHaveBeenCalled();
    vaporized.complete();

    expect(done).toHaveBeenCalled();
    expect(runs).toHaveBeenCalledTimes(1);
    expect(store.snapshot().currentState).toBe(GameState.START);
  });

  it('shows the result even when the effect fails', () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      bindEffect(() => {
        throw new Error('no context');
      });

      endMatch();

      expect(flow.panel()).toBe('over');
      expect(consoleError).toHaveBeenCalledWith(
        'The arena could not be vaporized',
        expect.any(Error)
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it('shows the result at the deadline when the effect never ends', () => {
    jest.useFakeTimers();
    try {
      bindEffect(() => new Observable<AnimationState>());
      const ms = TestBed.inject(GameSettingsService).value('vaporizeMs');

      endMatch();
      jest.advanceTimersByTime(ms + 5_000 - 1);
      expect(flow.panel()).toBeNull();
      jest.advanceTimersByTime(2);

      expect(flow.panel()).toBe('over');
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows the result without an effect while it is off', async () => {
    TestBed.inject(GameSettingsService).set('vaporize', 'off');

    endMatch();
    expect(flow.panel()).toBeNull();
    await Promise.resolve();

    expect(runs).not.toHaveBeenCalled();
    expect(flow.panel()).toBe('over');
  });

  it('takes no pause and no key of a match while the dust blows', () => {
    endMatch();
    const state = store.snapshot().currentState;

    flow.togglePause();
    TestBed.inject(StageInput).keyDown(keyEvent('p', document.body));

    expect(store.snapshot().currentState).toBe(state);
    // The HUD's pause and give-up buttons show only while a match runs.
    expect(TestBed.inject(HudState).running()).toBe(false);
    expect(flow.panel()).toBeNull();
  });

  it('still vaporizes on the reset when the match is given up', () => {
    flow.quitToMenu();
    TestBed.tick();

    expect(runs).toHaveBeenCalledTimes(1);
    expect(flow.dissolving()).toBe(false);
    expect(TestBed.inject(HudState).matchOver()).toBe(false);

    vaporized.complete();

    expect(flow.panel()).toBe('menu');
    expect(runs).toHaveBeenCalledTimes(1);
  });
});
