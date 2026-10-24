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
import { PLAIN_REPLAY_VERSION, playReplay, Replay, replayOf } from './replay';
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

const WIDTH = 320;
const HEIGHT = 140;

describe('GameStateService', () => {
  let service: GameStateService;
  let store: GameStateStore;
  let playerStore: PlayerStore;

  beforeEach(() => {
    TestBed.resetTestingModule();
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
      expect(replay.header).toEqual(
        expect.objectContaining({
          version: PLAIN_REPLAY_VERSION,
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

  beforeEach(() => {
    TestBed.resetTestingModule();
    online = new FakeOnline();
    TestBed.configureTestingModule({
      providers: [{ provide: OnlineMatchService, useValue: online }],
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
});
