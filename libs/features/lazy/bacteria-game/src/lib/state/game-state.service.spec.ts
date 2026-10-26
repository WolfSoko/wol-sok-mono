import type { Ruleset } from './simulation';
import { ProgressService } from '../progress.service';
import { TestBed } from '@angular/core/testing';
import { dailyLevelId } from './daily';
import { TICK_MS } from './fixed-tick';
import { GameStateService } from './game-state.service';
import { GameState, GameStateStore } from './game.states';
import { getLevel, LEVELS, levelCrosshairSpeed } from './levels';
import { PlayerStore } from './player.store';
import { ANNIHILATION, judgeOutcome } from './win-conditions';
import { PlayerService } from './player.service';
import { LADDER_VERSION } from './difficulty-curve';
import {
  LADDER_REPLAY_VERSION,
  playReplay,
  Replay,
  replayOf,
  REPLAY_VERSION,
} from './replay';
import { replayLink } from './replay-link';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { Lockstep, INPUT_DELAY_TICKS } from '../net/lockstep';
import type { OnlineStart } from '../net/net-message';
import {
  OnlineEvent,
  OnlineLobby,
  OnlineMatchService,
} from '../net/online-match.service';
import { FakeGameReplays } from '../../testing/fake-game-replays';
import { GameReplays } from '../storage/game-replays';
import { onlineIdOf } from '../storage/replay-records';
import { onlineReplayId } from './replay-id';
import { parseReplay } from './replay';
import { matchChecksum } from './checksum';
import { MatchEngine, cpuSimulation } from './match-engine';
import { planMatch } from './match-setup';
import type { NetMessage } from '../net/net-message';
import { attemptSeed, isRankedPlan, rankedPlan } from './attempts';
import { endlessLevelId } from './endless';
import { GPU_INT_REPLAY_VERSION } from './replay';
import type { RankedMatch } from './ranked-match';

const WIDTH = 320;
const HEIGHT = 140;

describe('GameStateService', () => {
  let service: GameStateService;
  let store: GameStateStore;
  let playerStore: PlayerStore;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: GameReplays, useValue: new FakeGameReplays() }],
    });
    service = TestBed.inject(GameStateService);
    store = TestBed.inject(GameStateStore);
    playerStore = TestBed.inject(PlayerStore);
    TestBed.inject(GameStateStore).update({ width: WIDTH, height: HEIGHT });
  });

  describe('setArenaSize', () => {
    it('spawns both colonies inside the arena', () => {
      service.setArenaSize(WIDTH, HEIGHT);

      for (const player of playerStore.entities()) {
        expect(player.x).toBeGreaterThan(0);
        expect(player.x).toBeLessThan(WIDTH);
        expect(player.y).toBeGreaterThan(0);
        expect(player.y).toBeLessThan(HEIGHT);
      }
    });
  });

  describe('setLevel', () => {
    it('stores the level', () => {
      service.setLevel('serpentine');

      expect(store.snapshot().levelId).toBe('serpentine');
    });

    it('gives the crosshairs the speed of the level', () => {
      service.setArenaSize(WIDTH, HEIGHT);

      service.setLevel('serpentine');

      const speed = levelCrosshairSpeed(getLevel('serpentine'));
      for (const player of playerStore.entities()) {
        expect(player.maxSpeed).toBe(speed);
      }
    });

    it('paints and names the colonies in the colours the players picked', () => {
      service.setArenaSize(WIDTH, HEIGHT);
      service.setMode('two-players');

      service.setColor(0, 'green');
      service.setColor(1, 'pink');

      const [left, right] = playerStore.entities();
      expect([left.name, right.name]).toEqual(['Green', 'Pink']);
      expect(left.color).toEqual([40, 200, 70, 255]);
      expect(right.color).toEqual([255, 70, 170, 255]);
    });

    it('swaps the colours when a seat picks the other one', () => {
      service.setColor(0, 'blue');

      expect(store.snapshot().colors).toEqual(['blue', 'orange']);
    });

    it('leaves a running match alone', () => {
      service.setArenaSize(WIDTH, HEIGHT);
      service.start();
      const before = playerStore.entities().map((player) => player.maxSpeed);

      service.setLevel('serpentine');

      expect(playerStore.entities().map((player) => player.maxSpeed)).toEqual(
        before
      );
      expect(store.snapshot().levelId).toBe('serpentine');
    });

    it('keeps the current level for an id that does not exist', () => {
      service.setLevel('serpentine');

      service.setLevel('not-a-level');

      expect(store.snapshot().levelId).toBe(getLevel('not-a-level').id);
    });
  });

  describe('setMode', () => {
    it('hands the second crosshair to the computer', () => {
      service.setArenaSize(WIDTH, HEIGHT);

      service.setMode('vs-computer');

      const [human, computer] = playerStore.entities();
      expect(store.snapshot().mode).toBe('vs-computer');
      expect(human.isBot).toBe(false);
      expect(human.name).toBe('You');
      expect(computer.isBot).toBe(true);
      expect(computer.name).toBe('Computer');
    });

    it('names both humans by colour', () => {
      service.setArenaSize(WIDTH, HEIGHT);

      service.setMode('two-players');

      expect(playerStore.entities().map((player) => player.name)).toEqual([
        'Orange',
        'Blue',
      ]);
      expect(playerStore.entities().some((player) => player.isBot)).toBe(false);
    });

    it('leaves a running match alone', () => {
      service.setArenaSize(WIDTH, HEIGHT);
      service.setMode('two-players');
      service.start();

      service.setMode('vs-computer');

      expect(playerStore.entities().some((player) => player.isBot)).toBe(false);
      expect(store.snapshot().mode).toBe('vs-computer');
    });

    it('leaves a paused match alone as well', () => {
      service.setArenaSize(WIDTH, HEIGHT);
      service.setMode('two-players');
      service.start();
      service.togglePause();

      service.setMode('vs-computer');

      expect(playerStore.entities().some((player) => player.isBot)).toBe(false);
    });
  });

  describe('setDifficulty', () => {
    it('stores the difficulty', () => {
      service.setDifficulty('hard');

      expect(store.snapshot().difficulty).toBe('hard');
    });
  });

  describe('boost', () => {
    it('fires the boost of a running match', () => {
      service.setArenaSize(WIDTH, HEIGHT);
      service.start();

      service.boost(0);

      expect(playerStore.entityMap()[0]?.boostActiveSec).toBeGreaterThan(0);
    });

    it('does nothing on the start screen', () => {
      service.setArenaSize(WIDTH, HEIGHT);

      service.boost(0);

      expect(playerStore.entityMap()[0]?.boostActiveSec).toBe(0);
    });
  });

  describe('head start', () => {
    function startingCounts(): number[] {
      return playerStore.entities().map((player) => player.bacteriaCount);
    }

    it('starts the colony of the seat without it smaller', () => {
      service.setMode('two-players');
      service.setArenaSize(WIDTH, HEIGHT);
      const [left, right] = startingCounts();
      expect(left).toBe(right);

      service.setHeadStart(-2);
      const [ahead, behind] = startingCounts();

      expect(ahead).toBe(left);
      expect(behind).toBeLessThan(right);
    });

    it('gives the computer none', () => {
      service.setHeadStart(2);
      service.setMode('vs-computer');
      service.setArenaSize(WIDTH, HEIGHT);
      const [human, computer] = startingCounts();

      expect(human).toBe(computer);
    });
  });

  describe('advance', () => {
    afterEach(() => service.cleanup());

    it('counts the ticks of a frame on the match clock', () => {
      service.setArenaSize(WIDTH, HEIGHT);
      service.init(WIDTH, HEIGHT);
      service.start();

      service.advance(WIDTH, HEIGHT, 3);

      expect(store.snapshot().timePassed).toBeCloseTo(3 * TICK_MS);
    });

    it('lands on every second exactly', () => {
      service.setArenaSize(WIDTH, HEIGHT);
      service.init(WIDTH, HEIGHT);
      service.start();

      for (let frame = 0; frame < 60; frame++) {
        service.advance(WIDTH, HEIGHT, 1);
      }

      expect(store.snapshot().timePassed).toBe(1000);
    });

    it('records a replay that plays the match out the same', () => {
      service.setMode('vs-computer');
      service.setDifficulty('hard');
      service.setArenaSize(WIDTH, HEIGHT);
      service.init(WIDTH, HEIGHT);
      service.start();
      const players = TestBed.inject(PlayerService);

      store.update({ keysPressed: ['d'] });
      service.advance(WIDTH, HEIGHT, 3);
      store.update({ keysPressed: [] });
      players.setDragTarget(0, 40, 20);
      service.boost(0);
      service.advance(WIDTH, HEIGHT, 3);
      for (let frame = 0; frame < 100; frame++) {
        service.advance(WIDTH, HEIGHT, 3);
      }

      const replay = service['replay']() as Replay;
      // Against the ladder's computer (ADR 0016): version 4.
      expect(replay.header).toEqual(
        expect.objectContaining({
          version: LADDER_REPLAY_VERSION,
          ladder: LADDER_VERSION,
          mode: 'vs-computer',
          difficulty: 'hard',
          simulation: 'cpu',
          ticks: 306,
        })
      );
      expect(playReplay(replay)?.players).toEqual(playerStore.entities());
    });

    it('plays no tick of the frame after the one that ended the match', () => {
      service.setArenaSize(WIDTH, HEIGHT);
      service.init(WIDTH, HEIGHT);
      service.start();
      const players = TestBed.inject(PlayerService);
      const tick = jest.spyOn(players, 'tick').mockImplementation(() => {
        if (tick.mock.calls.length === 2) {
          TestBed.inject(GameStateStore).update({
            currentState: GameState.END,
          });
        }
      });

      service.advance(WIDTH, HEIGHT, 5);

      expect(tick).toHaveBeenCalledTimes(2);
      expect(store.snapshot().timePassed).toBeCloseTo(2 * TICK_MS);
    });
  });

  describe('offerChallenge', () => {
    const run = replayOf(
      {
        levelId: 'corridors',
        mode: 'vs-computer',
        difficulty: 'hard',
        colors: ['orange', 'blue'],
        headStart: 0,
        width: WIDTH,
        height: HEIGHT,
        seed: 3,
      },
      'cpu',
      120,
      { steers: [[0, 0, 1, 0]], drags: [], boosts: [], weapons: [] }
    );

    async function hashOf(replay: Replay): Promise<string> {
      return new URL(await replayLink('http://localhost/game', replay)).hash;
    }

    it('offers the run a link carries as a ghost to fight', async () => {
      expect(await service.offerChallenge(await hashOf(run))).toBe(true);

      expect(store.challenge()).toEqual(run);
    });

    it('offers nothing for a broken link or a run between two players', async () => {
      const couch = {
        ...run,
        header: { ...run.header, mode: 'two-players' as const },
      };

      expect(await service.offerChallenge('#ghost=broken')).toBe(false);
      expect(await service.offerChallenge(await hashOf(couch))).toBe(false);
      expect(await service.offerChallenge('')).toBe(false);
      expect(store.challenge()).toBeNull();
    });
  });

  describe('match end', () => {
    // The progress service reads the storage as it is built, before any
    // beforeEach here runs: clear up after each match instead.
    afterEach(() => localStorage.clear());

    /** Starts a match and lets the computer's colony die out. */
    function winAgainst(mode: 'vs-computer' | 'two-players'): void {
      service.setMode(mode);
      service.setLevel('hourglass');
      service.setArenaSize(WIDTH, HEIGHT);
      service.init(WIDTH, HEIGHT);
      winMatch();
    }

    /** Starts a match as it is set up and lets the right colony die out. */
    function winMatch(): void {
      service.start();
      TestBed.inject(GameStateStore).update({ timePassed: 30_000 - TICK_MS });
      const [human, other] = playerStore.entities();
      playerStore.upsertPlayers([
        { ...human, bacteriaCount: 400, peakCount: 500 },
        { ...other, bacteriaCount: 0, lost: 300 },
      ]);
      // The next tick finds the colonies as set here, and the match over.
      const playerService = TestBed.inject(PlayerService);
      jest.spyOn(playerService, 'tick').mockImplementation(() => undefined);
      jest
        .spyOn(playerService, 'outcome')
        .mockImplementation(() =>
          judgeOutcome(ANNIHILATION, playerStore.entities(), 0)
        );
      service.advance(WIDTH, HEIGHT, 1);
      jest.restoreAllMocks();
    }

    afterEach(() => service.cleanup());

    describe('an endless run', () => {
      /** Ends the match on the run's level, won by the human or the bot. */
      function finish(humanWins: boolean, reset = true): void {
        service.start();
        const [human, bot] = playerStore.entities();
        playerStore.upsertPlayers([
          { ...human, bacteriaCount: humanWins ? 400 : 0, lost: 300 },
          { ...bot, bacteriaCount: humanWins ? 0 : 400, lost: 300 },
        ]);
        const players = TestBed.inject(PlayerService);
        jest.spyOn(players, 'tick').mockImplementation(() => undefined);
        jest
          .spyOn(players, 'outcome')
          .mockImplementation(() =>
            judgeOutcome(ANNIHILATION, playerStore.entities(), 0)
          );
        service.advance(WIDTH, HEIGHT, 1);
        jest.restoreAllMocks();
        if (reset) {
          service.reset();
        }
      }

      beforeEach(() => {
        service.setArenaSize(WIDTH, HEIGHT);
        service.init(WIDTH, HEIGHT);
      });

      it('climbs a level with every win and keeps the best run', () => {
        service.startEndless();
        const first = store.level().id;

        finish(true);
        service.continueEndless();

        expect(store.snapshot().endless?.wins).toBe(1);
        expect(store.level().id).not.toBe(first);
        expect(TestBed.inject(ProgressService).endlessBest()).toBe(1);
      });

      it('costs a life on a defeat, on the same level, until it is over', () => {
        service.startEndless();
        const level = store.level().id;

        finish(false);
        service.continueEndless();
        expect(store.snapshot().endless?.lives).toBe(2);
        expect(store.level().id).toBe(level);

        finish(false);
        service.continueEndless();
        finish(false);
        service.continueEndless();

        expect(store.snapshot().endless?.lives).toBe(0);
        // Over: no level is set for it any more.
        expect(store.snapshot().matchLevel).toBeNull();
      });

      it('outlasts the reset between its matches, and ends with another', () => {
        service.startEndless();
        service.reset();
        expect(store.snapshot().endless).not.toBeNull();

        // Left for a match of the setup, by whatever way.
        service.start();

        expect(store.snapshot().endless).toBeNull();
      });

      it('earns no medallion on its new levels, but keeps the depth', () => {
        service.startEndless();

        finish(true, false);

        expect(store.snapshot().earnings?.award).toBeNull();
        expect(TestBed.inject(ProgressService).endlessBest()).toBe(1);
      });
    });

    describe('a level for one match', () => {
      it('plays it against the computer, leaving the setup as it is', () => {
        service.setMode('two-players');
        service.setLevel('corridors');
        service.setArenaSize(WIDTH, HEIGHT);
        service.init(WIDTH, HEIGHT);

        service.playDaily('2026-10-20');
        winMatch();

        const state = store.snapshot();
        expect(store.matchMode()).toBe('vs-computer');
        expect(store.level().id).toBe(dailyLevelId('2026-10-20'));
        expect(state.levelId).toBe('corridors');
        expect(state.series).toBeNull();
        expect(state.earnings?.award?.record.levelId).toBe(
          dailyLevelId('2026-10-20')
        );
        expect(state.lastReplay?.header).toEqual(
          expect.objectContaining({
            levelId: dailyLevelId('2026-10-20'),
            mode: 'vs-computer',
          })
        );
      });

      it('counts an attempt with every start of the daily level', () => {
        const attempt = jest.spyOn(
          TestBed.inject(ProgressService),
          'startDailyAttempt'
        );
        service.setArenaSize(WIDTH, HEIGHT);
        service.playDaily('2026-10-20');

        service.start();
        // Restart from the pause menu: no reset in between.
        service.start();

        expect(attempt).toHaveBeenCalledTimes(2);
        expect(attempt).toHaveBeenCalledWith('2026-10-20');
      });

      it('holds for that one match', () => {
        service.setArenaSize(WIDTH, HEIGHT);
        service.playDaily('2026-10-20');

        service.reset();

        expect(service.oneMatch()).toEqual({
          ghost: null,
          matchLevel: null,
          dailyDay: null,
          endlessMatch: false,
        });
        expect(store.level().id).toBe(store.snapshot().levelId);
      });
    });

    describe('a training mission', () => {
      it('plays its level against the easy computer and keeps the mission', () => {
        service.setMode('two-players');
        service.setDifficulty('hard');
        service.setLevel('corridors');
        service.setArenaSize(WIDTH, HEIGHT);
        service.init(WIDTH, HEIGHT);

        service.playMission('fight');
        winMatch();

        const state = store.snapshot();
        expect(store.matchMode()).toBe('vs-computer');
        expect(store.level().id).toBe('training-fight');
        // The setup stays as it is, for the next match outside the training.
        expect(state.levelId).toBe('corridors');
        expect(state.difficulty).toBe('hard');
        expect(state.earnings).toMatchObject({
          award: null,
          training: { shortfall: null, first: true, next: 'steer' },
        });
        // A training match leaves no run to fight as a ghost.
        expect(state.lastReplay).toBeNull();
        expect(TestBed.inject(ProgressService).training().fight).toBeDefined();
      });

      it('puts the training dummy across where the mission has one', () => {
        service.setArenaSize(WIDTH, HEIGHT);
        service.playMission('attack');
        service.start();

        expect(playerStore.entities()[1]).toMatchObject({
          name: 'Dummy',
          isBot: true,
        });
      });
    });

    describe('against the ghost', () => {
      it('plays the last run on its level, leaving the setup as it is', () => {
        winAgainst('vs-computer');
        const run = store.snapshot().lastReplay;
        service.setLevel('corridors');

        service.playGhost();
        service.start();

        expect(store.snapshot().ghost).toBe(run);
        expect(store.level().id).toBe('hourglass');
        expect(store.snapshot().levelId).toBe('corridors');
        expect(playerStore.entities()[1].name).toBe('Ghost');
      });

      it('earns nothing, and keeps the run it plays as the last one', () => {
        winAgainst('vs-computer');
        const run = store.snapshot().lastReplay;
        service.playGhost();

        winMatch();

        const state = store.snapshot();
        expect(state.currentState).toBe(GameState.END);
        expect(state.earnings).toBeNull();
        expect(state.lastReplay).toBe(run);
      });

      it('holds for the one match it was set for', () => {
        winAgainst('vs-computer');
        service.playGhost();
        // A setup restored late changes the next match, not the ghost's.
        service.applySetup({ difficulty: 'hard' });
        expect(store.snapshot().ghost).not.toBeNull();

        service.reset();
        service.start();

        expect(store.snapshot().ghost).toBeNull();
        expect(playerStore.entities()[1].name).toBe('Computer');
      });

      it('plays no part in a series between two players', () => {
        winAgainst('vs-computer');
        const run = store.snapshot().lastReplay;
        service.setMode('two-players');
        service.setSeriesLength(3);

        service.playGhost(run);
        service.start();

        expect(store.snapshot().series).toBeNull();
        expect(playerStore.entities()[1].name).toBe('Ghost');
      });

      it('needs a run against the computer', () => {
        service.playGhost();
        expect(store.snapshot().ghost).toBeNull();

        winAgainst('two-players');
        service.playGhost();
        expect(store.snapshot().ghost).toBeNull();
      });
    });

    it('judges a win against the computer and keeps the award', () => {
      winAgainst('vs-computer');

      const state = store.snapshot();
      expect(state.currentState).toBe(GameState.END);
      expect(state.endedBy).toBe('annihilation');
      expect(state.lastReplay?.header.levelId).toBe('hourglass');
      expect(state.earnings?.award).toEqual(
        expect.objectContaining({
          medal: 'platinum',
          previousBest: null,
          record: expect.objectContaining({
            levelId: 'hourglass',
            won: true,
            durationSec: 30,
          }),
        })
      );
    });

    it('awards nothing between two players', () => {
      winAgainst('two-players');

      expect(store.snapshot().endedBy).toBe('annihilation');
      expect(store.snapshot().earnings?.award).toBeNull();
    });

    it('keeps the achievements the match earned, in either mode', () => {
      winAgainst('vs-computer');
      expect(store.snapshot().earnings?.achievements).toContain('first-blood');

      service.start();
      expect(store.snapshot().earnings).toBeNull();
    });

    it('counts a match between two players', () => {
      winAgainst('two-players');

      expect(TestBed.inject(ProgressService).totals().couchMatches).toBe(1);
    });

    it('records what the colonies did against the computer', () => {
      winAgainst('vs-computer');

      expect(store.snapshot().earnings?.award?.record).toEqual(
        expect.objectContaining({
          enemyCrushed: 300,
          peakShare: expect.any(Number),
        })
      );
      expect(
        store.snapshot().earnings?.award?.record.peakShare
      ).toBeGreaterThan(0);
    });

    it('plays a series between two players to the end', () => {
      service.setSeriesLength(3);
      winAgainst('two-players');
      expect(store.snapshot().series?.wins).toEqual([1, 0]);

      winAgainst('two-players');
      expect(store.snapshot().series).toEqual({ bestOf: 3, wins: [2, 0] });

      // Taken: the next match starts a new one.
      service.start();
      expect(store.snapshot().series?.wins).toEqual([0, 0]);
    });

    it('ends a series when its setup changes, or on request', () => {
      service.setSeriesLength(3);
      winAgainst('two-players');

      service.setColor(0, 'orange');
      expect(store.snapshot().series).not.toBeNull();
      service.setHeadStart(1);
      expect(store.snapshot().series).toBeNull();

      winAgainst('two-players');
      service.endSeries();
      expect(store.snapshot().series).toBeNull();
    });

    it('carries a series from level to level', () => {
      service.setSeriesLength(3);
      winAgainst('two-players');

      service.setLevel('corridors');

      expect(store.snapshot().series?.wins).toEqual([1, 0]);
    });

    it('plays single matches without a series', () => {
      winAgainst('two-players');

      expect(store.snapshot().series).toBeNull();
    });

    it('counts the win for the winning colour', () => {
      winAgainst('two-players');

      expect(TestBed.inject(ProgressService).couchWins()).toEqual({
        orange: 1,
      });
    });

    it('starts the match clock over on a restart', () => {
      winAgainst('vs-computer');

      service.start();

      expect(store.snapshot().timePassed).toBe(0);
    });

    it('forgets the award as the next match starts', () => {
      winAgainst('vs-computer');

      service.start();

      expect(store.snapshot().earnings).toBeNull();
    });
  });
});

describe('GameStateService online', () => {
  /** The online service, without a network: the test plays the other device. */
  class FakeOnline {
    public readonly events = new Subject<OnlineEvent>();
    public readonly events$ = this.events.asObservable();
    public readonly lobby = signal<OnlineLobby>({
      phase: 'idle',
      role: null,
      code: null,
      notice: null,
    });
    public readonly sent: unknown[] = [];
    public readonly share = jest.fn();
    public readonly offerColors = jest.fn();
    public readonly leave = jest.fn();
    public pending: { start: OnlineStart; lockstep: Lockstep } | null = null;
    public startMatch = jest.fn(
      (start: OnlineStart) =>
        new Lockstep(0, (message) => this.sent.push({ ...start, ...message }))
    );
    public matchRef = jest.fn(() => ({ roomCode: 'K7QPXM', n: 1 }));
    public agreedRuleset = jest.fn((): Ruleset => 'cpu');
    public takeStart() {
      const pending = this.pending;
      this.pending = null;
      return pending;
    }
    public connect(seat: 0 | 1): void {
      this.lobby.set({
        phase: 'connected',
        role: seat === 0 ? 'host' : 'guest',
        code: null,
        notice: null,
      });
      this.events.next({ type: 'connected', seat });
    }
  }

  let service: GameStateService;
  let store: GameStateStore;
  let playerStore: PlayerStore;
  let online: FakeOnline;
  let replays: FakeGameReplays;

  beforeEach(() => {
    TestBed.resetTestingModule();
    online = new FakeOnline();
    replays = new FakeGameReplays();
    TestBed.configureTestingModule({
      providers: [
        { provide: OnlineMatchService, useValue: online },
        { provide: GameReplays, useValue: replays },
      ],
    });
    service = TestBed.inject(GameStateService);
    store = TestBed.inject(GameStateStore);
    playerStore = TestBed.inject(PlayerStore);
    service.setArenaSize(320, 180);
  });

  it('shares the setup and starts the match as the host', () => {
    service.setLevel('petri-dish');
    online.connect(0);

    expect(store.snapshot().online).toEqual({
      seat: 0,
      levelId: 'petri-dish',
      colors: store.snapshot().colors,
    });
    expect(online.share).toHaveBeenCalledWith({
      levelId: 'petri-dish',
      colors: store.snapshot().colors,
    });

    service.setLevel('serpentine');
    expect(online.share).toHaveBeenLastCalledWith(
      expect.objectContaining({ levelId: 'serpentine' })
    );

    service.start();

    expect(online.startMatch).toHaveBeenCalledWith(
      expect.objectContaining({ levelId: 'serpentine' })
    );
    expect(store.snapshot().currentState).toBe(GameState.RUNNING);
    const [you, opponent] = playerStore.entities();
    expect([you.name, you.isBot]).toEqual(['You', false]);
    expect([opponent.name, opponent.isBot]).toEqual(['Opponent', true]);
  });

  it('waits for the other device, and says so after a while', () => {
    online.connect(0);
    service.start();

    for (let frame = 0; frame < 30; frame++) {
      service.advance(320, 180, 1);
    }

    expect(TestBed.inject(PlayerService).tickCount).toBe(INPUT_DELAY_TICKS);
    expect(store.snapshot().waitingForPeer).toBe(true);
  });

  it('gives the match to the player left when the other one goes', () => {
    online.connect(1);
    online.pending = {
      start: { levelId: 'petri-dish', colors: ['orange', 'blue'], seed: 9 },
      lockstep: new Lockstep(1, () => undefined),
    };
    service.start();
    expect(store.snapshot().currentState).toBe(GameState.RUNNING);

    online.events.next({ type: 'ended', reason: 'left' });

    const state = store.snapshot();
    expect(state.currentState).toBe(GameState.END);
    expect(state.endedBy).toBe('forfeit');
    expect(state.winner?.id).toBe(1);
    expect(state.earnings).toBeNull();
    expect(state.online).toBeNull();
  });

  it('takes no big map online', () => {
    service.setLevel('expanse');

    online.connect(0);

    expect(store.snapshot().online?.levelId).toBe(LEVELS[0].id);
  });

  it('ends a match out of step even while it waits for the other device', () => {
    online.connect(0);
    service.start();
    for (let frame = 0; frame < INPUT_DELAY_TICKS + 2; frame++) {
      service.advance(320, 180, 1);
    }
    const lockstep = online.startMatch.mock.results[0].value as Lockstep;

    lockstep.putRemoteSum(60, 1);
    lockstep.ticked(60, playerStore.entities());
    service.advance(320, 180, 1);

    expect(store.snapshot().endedBy).toBe('desync');
    expect(store.snapshot().winner).toBeNull();
  });

  it('starts nothing as the guest until the host started', () => {
    online.connect(1);

    service.start();

    expect(store.snapshot().currentState).toBe(GameState.START);
  });

  describe('the recording', () => {
    /** The guest's device: a plain engine and its lockstep, as in the lockstep spec. */
    interface Guest {
      lockstep: Lockstep;
      engine: MatchEngine;
      outbox: NetMessage[];
    }

    function deliver(outbox: NetMessage[], to: Lockstep): void {
      for (const message of outbox.splice(0)) {
        if (message.k === 'in') {
          to.putRemote(message.t, message);
        } else if (message.k === 'sum') {
          to.putRemoteSum(message.t, message.h);
        }
      }
    }

    it('records an online match that plays back the same, with the id both devices know', async () => {
      const hostOutbox: NetMessage[] = [];
      let guest: Guest | null = null;
      online.startMatch.mockImplementation((start: OnlineStart) => {
        const outbox: NetMessage[] = [];
        const lockstep = new Lockstep(1, (message) => outbox.push(message));
        const { spawns, options } = planMatch(
          {
            levelId: start.levelId,
            mode: 'two-players',
            difficulty: store.snapshot().difficulty,
            colors: start.colors,
            headStart: 0,
            width: 320,
            height: 180,
            seed: start.seed,
          },
          null,
          { seat: 1, drivers: lockstep.drivers() }
        );
        guest = {
          lockstep,
          engine: new MatchEngine(spawns, {
            ...options,
            simulation: cpuSimulation,
          }),
          outbox,
        };
        return new Lockstep(0, (message) => hostOutbox.push(message));
      });
      service.setLevel('petri-dish');
      online.connect(0);
      service.start();
      const host = online.startMatch.mock.results[0].value as Lockstep;
      const seed = online.startMatch.mock.calls[0][0].seed;
      const other = guest as unknown as Guest;

      for (let frame = 0; frame < 400; frame++) {
        store.update({ keysPressed: frame < 150 ? ['d', 's'] : ['a'] });
        service.advance(320, 180, 1);
        if (other.lockstep.ready(other.engine.tickCount)) {
          other.lockstep.putLocal(
            other.engine.tickCount,
            { x: frame < 200 ? -1 : 1, y: 0.5 },
            frame === 90 ? { x: 100, y: 60 } : null,
            frame === 250
          );
          other.engine.tick(320, 180);
          other.lockstep.ticked(other.engine.tickCount, other.engine.players);
        }
        deliver(hostOutbox, other.lockstep);
        deliver(other.outbox, host);
      }
      online.events.next({ type: 'ended', reason: 'left' });
      await Promise.resolve();

      const recording = service.lastRecording();
      expect(recording).not.toBeNull();
      const replay = recording?.replay as Replay;
      expect(replay.header).toEqual(
        expect.objectContaining({
          version: REPLAY_VERSION,
          mode: 'two-players',
          headStart: 0,
          roomCode: 'K7QPXM',
          n: 1,
          seats: [{ isBot: false }, { isBot: false }],
          outcome: { endedBy: 'forfeit', winnerSeat: 0 },
        })
      );
      expect(parseReplay(replay, { stored: true })).toEqual(replay);
      // Both devices name the match alike.
      expect(onlineIdOf(replay)).toBe(onlineReplayId('K7QPXM', 1, seed));
      expect(recording?.id).toBe(onlineReplayId('K7QPXM', 1, seed));
      // Played again, it comes to the checksum the devices played.
      const played = playReplay(replay);
      expect(played?.ticks).toBe(replay.header.ticks);
      expect(played?.checksum).toBe(replay.header.checksum);
      expect(store.snapshot().lastReplay).toBe(replay);
      // The guest played the same match, as far as it got.
      expect(other.engine.tickCount).toBeGreaterThan(0);
      const guestReplay = playReplay({
        ...replay,
        header: { ...replay.header, ticks: other.engine.tickCount },
      });
      expect(guestReplay?.checksum).toBe(matchChecksum(other.engine.players));
    });

    it('keeps an online match even with saving off', async () => {
      service.setReplayPrefs({ saveMatches: false });
      online.connect(0);
      service.start();
      online.events.next({ type: 'ended', reason: 'left' });
      await Promise.resolve();

      expect(replays.submissions).toHaveLength(1);
      expect(replays.submissions[0].replay.header.roomCode).toBe('K7QPXM');
    });
  });
});

describe('GameStateService local recordings', () => {
  let service: GameStateService;
  let store: GameStateStore;
  let players: PlayerService;
  let replays: FakeGameReplays;

  beforeEach(() => {
    TestBed.resetTestingModule();
    replays = new FakeGameReplays();
    TestBed.configureTestingModule({
      providers: [{ provide: GameReplays, useValue: replays }],
    });
    service = TestBed.inject(GameStateService);
    store = TestBed.inject(GameStateStore);
    players = TestBed.inject(PlayerService);
    service.setLevel('petri-dish');
    // Off by default until the CPU's medal limits are checked (ADR 0011).
    service.setReplayPrefs({ recordLocal: true });
  });

  afterEach(() => {
    service.cleanup();
    localStorage.clear();
    jest.restoreAllMocks();
  });

  /** A GPU simulation, as far as the game can tell. */
  function useGpu(): void {
    players.useSimulation((balance, random, seed) => {
      const simulation = cpuSimulation(balance, random, seed);
      Object.defineProperty(simulation, 'kind', { value: 'gpu' });
      Object.defineProperty(simulation, 'ruleset', { value: null });
      return simulation;
    });
  }

  /** Plays a match of two seconds on a 320x180 arena and ends it on time. */
  async function play(mode: 'vs-computer' | 'two-players'): Promise<void> {
    service.setMode(mode);
    service.setArenaSize(320, 180);
    service.init(320, 180);
    service.start();
    for (let frame = 0; frame < 120; frame++) {
      store.update({ keysPressed: frame < 60 ? ['d'] : ['w'] });
      if (frame === 119) {
        jest
          .spyOn(players, 'outcome')
          .mockReturnValue({ winner: null, reason: 'time' });
      }
      service.advance(320, 180, 1);
    }
    await Promise.resolve();
  }

  it('records a match against the computer on the CPU and keeps it', async () => {
    useGpu();

    await play('vs-computer');

    const recording = service.lastRecording();
    const replay = recording?.replay as Replay;
    // A ladder match against the computer: its computer plays the curve.
    expect(replay.header).toEqual(
      expect.objectContaining({
        version: LADDER_REPLAY_VERSION,
        simulation: 'cpu',
        mode: 'vs-computer',
        width: 320,
        height: 180,
        ticks: 120,
        outcome: { endedBy: 'time', winnerSeat: null },
        checksum: matchChecksum(players.players),
      })
    );
    expect(replay.header.roomCode).toBeUndefined();
    expect(parseReplay(replay, { stored: true })).toEqual(replay);
    expect(playReplay(replay)?.checksum).toBe(replay.header.checksum);
    expect(recording?.hint).toBeGreaterThanOrEqual(0);
    expect(replays.submissions).toEqual([{ replay, hint: recording?.hint }]);
    expect(recording?.id).toBe('l_fake0');
    expect(store.snapshot().lastReplay).toBe(replay);
  });

  it('keeps nothing with "Save my matches" off, but still records', async () => {
    service.setReplayPrefs({ saveMatches: false });

    await play('vs-computer');

    expect(service.lastRecording()).not.toBeNull();
    expect(replays.submissions).toEqual([]);
  });

  it('records nothing on the GPU with recording off', async () => {
    useGpu();
    service.setReplayPrefs({ recordLocal: false });

    await play('vs-computer');

    expect(players.getSimulation().kind).toBe('gpu');
    expect(service.lastRecording()).toBeNull();
    expect(replays.submissions).toEqual([]);
    // Still a run for a ghost race.
    expect(store.snapshot().lastReplay?.header.simulation).toBe('gpu');
  });

  it('records no couch match', async () => {
    await play('two-players');

    expect(service.lastRecording()).toBeNull();
    expect(replays.submissions).toEqual([]);
  });

  it('records no ghost match', async () => {
    await play('vs-computer');
    replays.submissions.splice(0);
    service.playGhost();

    await play('vs-computer');

    expect(service.lastRecording()).toBeNull();
    expect(replays.submissions).toEqual([]);
  });

  it('records nothing off the online grid, which no server could check', async () => {
    service.setMode('vs-computer');
    service.setArenaSize(480, 270);
    service.init(480, 270);
    service.start();
    jest
      .spyOn(players, 'outcome')
      .mockReturnValue({ winner: null, reason: 'time' });
    service.advance(480, 270, 1);
    await Promise.resolve();

    expect(service.lastRecording()).toBeNull();
    expect(replays.submissions).toEqual([]);
  });
});

describe('GameStateService ranked matches', () => {
  const DAY = '2026-10-26';
  const AT = Date.UTC(2026, 9, 26, 12);
  let service: GameStateService;
  let store: GameStateStore;
  let players: PlayerService;
  let replays: FakeGameReplays;

  function declared(id: string, uid = 'ada'): RankedMatch {
    return { attempt: { id, at: AT }, seed: attemptSeed(uid, id, AT) };
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    replays = new FakeGameReplays();
    TestBed.configureTestingModule({
      providers: [{ provide: GameReplays, useValue: replays }],
    });
    service = TestBed.inject(GameStateService);
    store = TestBed.inject(GameStateStore);
    players = TestBed.inject(PlayerService);
    // A player who records nothing and keeps nothing - and set up harder.
    service.setReplayPrefs({ recordLocal: false, saveMatches: false });
    service.setDifficulty('hard');
    service.setHeadStart(2);
  });

  afterEach(() => {
    service.cleanup();
    localStorage.clear();
    jest.restoreAllMocks();
  });

  /** Plays a few ticks on the arena the game lays out for it and ends on time. */
  async function play(): Promise<void> {
    const { width, height } = rankedPlan(
      store.snapshot().matchLevel ?? 'petri-dish',
      0
    );
    service.setArenaSize(width, height);
    service.init(width, height);
    service.start();
    for (let frame = 0; frame < 10; frame++) {
      if (frame === 9) {
        jest
          .spyOn(players, 'outcome')
          .mockReturnValue({ winner: null, reason: 'time' });
      }
      service.advance(width, height, 1);
    }
    await Promise.resolve();
  }

  it('plays a ranked daily attempt on the ranked plan, gpu-int, and uploads it with its attempt', async () => {
    const match = declared(`d_${DAY}_1`);
    service.playDaily(DAY, { match, note: { kind: 'daily', n: 1 } });

    await play();

    const replay = service.lastRecording()?.replay as Replay;
    const { width, height } = rankedPlan(dailyLevelId(DAY), match.seed);
    expect(replay.header).toEqual(
      expect.objectContaining({
        version: GPU_INT_REPLAY_VERSION,
        simulation: 'gpu-int',
        levelId: dailyLevelId(DAY),
        mode: 'vs-computer',
        difficulty: 'normal',
        headStart: 0,
        width,
        height,
        seed: match.seed,
        attempt: match.attempt,
      })
    );
    expect(isRankedPlan(replay.header)).toBe(true);
    expect(parseReplay(replay, { stored: true })).toEqual(replay);
    expect(replays.submissions).toEqual([
      { replay, hint: expect.any(Number), attempt: `d_${DAY}_1` },
    ]);
    expect(store.snapshot().rankedNote).toEqual({ kind: 'daily', n: 1 });
  });

  it('forgets the declaration with the reset: a rematch never plays it again', async () => {
    service.playDaily(DAY, {
      match: declared(`d_${DAY}_1`),
      note: { kind: 'daily', n: 1 },
    });
    await play();
    const rematch = service.oneMatch();

    service.reset();
    service.replayOneMatch(rematch);

    expect(store.snapshot().ranked).toBeNull();
    expect(store.snapshot().rankedNote).toBeNull();
    expect(store.snapshot().dailyDay).toBe(DAY);
  });

  it('plays an unranked daily match on the setup, and says why', async () => {
    service.playDaily(DAY, {
      match: null,
      note: { kind: 'unranked', reason: 'offline' },
    });

    await play();

    expect(service.lastRecording()).toBeNull();
    expect(replays.submissions).toEqual([]);
    expect(store.snapshot().rankedNote).toEqual({
      kind: 'unranked',
      reason: 'offline',
    });
  });

  it("takes a ranked run's levels from the seed of its match 0", async () => {
    const match = declared('e_202610261_0');
    service.startEndless({
      outcome: { match, note: { kind: 'endless', match: 1 } },
      run: { runId: '202610261', next: 1 },
    });

    expect(store.snapshot().endless?.seed).toBe(match.seed);
    expect(store.snapshot().matchLevel).toBe(
      endlessLevelId({ seed: match.seed, wins: 0, lives: 3 })
    );
    await play();

    expect(replays.submissions[0]?.attempt).toBe('e_202610261_0');
    expect(store.snapshot().endlessRanked).toEqual({
      runId: '202610261',
      next: 1,
    });
  });

  it('goes on with the next declared match, and drops the run once it plays unranked', async () => {
    service.startEndless({
      outcome: {
        match: declared('e_202610261_0'),
        note: { kind: 'endless', match: 1 },
      },
      run: { runId: '202610261', next: 1 },
    });
    await play();
    service.reset();

    service.continueEndless({
      outcome: {
        match: null,
        note: { kind: 'unranked', reason: 'run-dropped' },
      },
      run: null,
    });

    expect(store.snapshot().endlessRanked).toBeNull();
    expect(store.snapshot().ranked).toBeNull();
    expect(store.snapshot().endless).not.toBeNull();
  });

  it('leaves the ranked run with any other match', async () => {
    service.startEndless({
      outcome: {
        match: declared('e_202610261_0'),
        note: { kind: 'endless', match: 1 },
      },
      run: { runId: '202610261', next: 1 },
    });
    await play();
    service.reset();
    service.setLevel('petri-dish');

    await play();

    expect(store.snapshot().endless).toBeNull();
    expect(store.snapshot().endlessRanked).toBeNull();
  });
});
