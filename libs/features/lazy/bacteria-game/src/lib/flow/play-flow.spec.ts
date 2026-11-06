import { TestBed } from '@angular/core/testing';
import { EMPTY } from 'rxjs';
import { StageBusy } from '../busy/stage-busy';
import { RankedService } from '../ranked/ranked.service';
import { GameSettingsService } from '../settings.service';
import { GameStateService } from '../state/game-state.service';
import { STAGE_PROVIDERS } from '../stage-providers';
import { ArenaStage } from '../stage/arena-stage';
import { StageFullscreen } from '../stage/stage-fullscreen';
import { GameState, GameStateStore } from '../state/game.states';
import { LEVELS, replayOf } from '@wolsok/feat-shared-bacteria-engine';
import { PlayerStore } from '../state/player.store';
import { stubActivation, stubFullscreen } from '../../testing/fullscreen-stubs';
import { PlayFlow } from './play-flow';

describe('PlayFlow', () => {
  let flow: PlayFlow;
  let store: GameStateStore;

  beforeEach(() => {
    localStorage.clear();
    stubFullscreen(null);
    stubActivation(false);
    TestBed.configureTestingModule({ providers: STAGE_PROVIDERS });
    flow = TestBed.inject(PlayFlow);
    store = TestBed.inject(GameStateStore);
  });

  /**
   * Holds the work a tap sets off behind the spinner, rather than waiting
   * out the frame.
   */
  function holdBusyWork(): Array<() => void | Promise<unknown>> {
    const held: Array<() => void | Promise<unknown>> = [];
    jest
      .spyOn(TestBed.inject(StageBusy), 'run')
      .mockImplementation((work) => held.push(work));
    return held;
  }

  /** Keeps `startGame` from starting a match, and gives back its spy. */
  function spyOnStart(): jest.SpyInstance {
    return jest.spyOn(flow, 'startGame').mockImplementation(() => undefined);
  }

  describe('a new game', () => {
    it('sets the game up for the mode picked', () => {
      const settings = TestBed.inject(GameSettingsService);

      flow.setPlayKind('two-players');
      expect(store.snapshot().mode).toBe('two-players');

      flow.setPlayKind('free');
      expect(store.snapshot().mode).toBe('vs-computer');
      expect(settings.value('freePlay')).toBe(true);

      flow.setPlayKind('campaign');
      expect(settings.value('freePlay')).toBe(false);
    });
  });

  describe('a shared run', () => {
    const run = replayOf(
      {
        levelId: LEVELS[3].id,
        mode: 'vs-computer',
        difficulty: 'normal',
        colors: ['orange', 'blue'],
        headStart: 0,
        width: 320,
        height: 140,
        seed: 9,
      },
      'cpu',
      600,
      { steers: [[0, 0, 1, 0]], drags: [], boosts: [], weapons: [] }
    );

    it('starts a match against it on Fight it', async () => {
      store.update({ challenge: run });

      const held = holdBusyWork();
      flow.fightChallenge();
      await held[0]();

      expect(store.next()).toEqual({ kind: 'ghost', run });
      expect(store.challenge()).toBeNull();
      expect(store.level().id).toBe(LEVELS[3].id);
      expect(TestBed.inject(PlayerStore).entities()[1].name).toBe('Ghost');
    });

    it('lets it go on Not now', () => {
      store.update({ challenge: run });

      flow.dismissChallenge();

      expect(store.challenge()).toBeNull();
      expect(store.next().kind).toBe('setup');
    });
  });

  describe('a match started from a tap', () => {
    it('takes the screen on the tap, and sets the match up behind the spinner', async () => {
      const held = holdBusyWork();
      const fullscreen = jest
        .spyOn(TestBed.inject(StageFullscreen), 'requestNative')
        .mockImplementation(() => undefined);
      const start = spyOnStart();

      flow.startNewGame('campaign');

      expect(fullscreen).toHaveBeenCalled();
      expect(start).not.toHaveBeenCalled();
      await held[0]();
      expect(start).toHaveBeenCalledTimes(1);
    });

    it('starts an online match on the tap, in step with the other device', () => {
      const held = holdBusyWork();
      const start = spyOnStart();

      flow.startNewGame('online');

      expect(start).toHaveBeenCalledTimes(1);
      expect(held).toEqual([]);
    });

    it('starts the next campaign match from the result screen at once', () => {
      const held = holdBusyWork();
      const start = spyOnStart();

      flow.playFurthestLevel();

      expect(start).toHaveBeenCalledTimes(1);
      expect(held).toEqual([]);
    });

    it('stays busy until a daily match is under way', async () => {
      const held = holdBusyWork();
      let started = (): void => undefined;
      jest
        .spyOn(flow, 'playDaily')
        .mockImplementation(
          () => new Promise<void>((resolve) => (started = resolve))
        );

      flow.startNewGame('daily');
      let done = false;
      const work = Promise.resolve(held[0]()).then(() => (done = true));
      await Promise.resolve();

      expect(done).toBe(false);
      started();
      await work;
      expect(done).toBe(true);
    });
  });

  describe('a start that waits', () => {
    /** Holds the arena not ready yet, and gives back its release. */
    function holdArena(): () => void {
      let ready = (): void => undefined;
      jest
        .spyOn(TestBed.inject(ArenaStage), 'whenReady')
        .mockImplementation(() => new Promise<void>((done) => (ready = done)));
      return () => ready();
    }

    /** Holds the daily's ranked declaration, and gives back its answer. */
    function holdDeclaration(): () => void {
      const ranked = TestBed.inject(RankedService);
      jest.spyOn(ranked, 'wants').mockReturnValue(true);
      let answer = (): void => undefined;
      jest.spyOn(ranked, 'declareDaily').mockImplementation(
        () =>
          new Promise((done) => {
            answer = () => done(null as never);
          })
      );
      return () => answer();
    }

    it('starts the daily match once the arena is ready, not before', async () => {
      const ready = holdArena();
      const start = spyOnStart();

      const daily = flow.playDaily();
      await Promise.resolve();
      expect(start).not.toHaveBeenCalled();

      ready();
      await daily;
      expect(start).toHaveBeenCalledTimes(1);
    });

    it('starts nothing once another match started while the arena got ready', async () => {
      const ready = holdArena();
      const start = spyOnStart();

      const daily = flow.playDaily();
      store.update({ currentState: GameState.RUNNING });
      ready();
      await daily;

      expect(start).not.toHaveBeenCalled();
    });

    it('drops a declared start when a match came and went meanwhile', async () => {
      const answer = holdDeclaration();
      const start = spyOnStart();
      const play = jest.spyOn(TestBed.inject(GameStateService), 'playDaily');

      const daily = flow.playDaily();
      // A match is given up, and its arena clear again, before the answer.
      jest.spyOn(TestBed.inject(ArenaStage), 'vaporize').mockReturnValue(EMPTY);
      flow.resetGame$().subscribe();
      expect(flow.resetting()).toBe(false);
      answer();
      await daily;

      expect(play).not.toHaveBeenCalled();
      expect(start).not.toHaveBeenCalled();
    });
  });

  describe('giving a ranked match up', () => {
    function armed(): jest.SpyInstance {
      return jest.spyOn(flow, 'quitToMenu').mockImplementation(() => undefined);
    }

    it('quits on the second tap only, while the first is armed', () => {
      const quit = armed();

      flow.giveUp();
      expect(flow.giveUpArmed()).toBe(true);
      expect(quit).not.toHaveBeenCalled();

      flow.giveUp();
      expect(quit).toHaveBeenCalledTimes(1);
      expect(flow.giveUpArmed()).toBe(false);
    });

    it('does not carry a first tap over into the next match', () => {
      const quit = armed();

      flow.giveUp();
      flow.startGame();
      expect(flow.giveUpArmed()).toBe(false);

      flow.giveUp();
      expect(quit).not.toHaveBeenCalled();
    });

    it('disarms by itself after a while', () => {
      const quit = armed();
      const timers = jest.spyOn(globalThis, 'setTimeout');

      flow.giveUp();
      const [disarm, ms] = timers.mock.calls.at(-1) ?? [];
      expect(ms).toBe(3_000);
      (disarm as () => void)();
      expect(flow.giveUpArmed()).toBe(false);

      flow.giveUp();
      expect(quit).not.toHaveBeenCalled();
      timers.mockRestore();
    });
  });
});
