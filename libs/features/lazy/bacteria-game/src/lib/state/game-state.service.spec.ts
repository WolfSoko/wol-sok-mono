import { ProgressService } from '../progress.service';
import { TestBed } from '@angular/core/testing';
import { TICK_MS } from './fixed-tick';
import { GameStateQuery } from './game-state.query';
import { GameStateService } from './game-state.service';
import { GameState, GameStateStore } from './game.states';
import { getLevel, levelCrosshairSpeed } from './levels';
import { PlayerQuery } from './player.query';
import { PlayerService } from './player.service';
import { PlayerStore } from './player.store';

const WIDTH = 320;
const HEIGHT = 140;

describe('GameStateService', () => {
  let service: GameStateService;
  let query: GameStateQuery;
  let playerQuery: PlayerQuery;

  beforeEach(() => {
    TestBed.resetTestingModule();
    service = TestBed.inject(GameStateService);
    query = TestBed.inject(GameStateQuery);
    playerQuery = TestBed.inject(PlayerQuery);
    TestBed.inject(GameStateStore).update({ width: WIDTH, height: HEIGHT });
  });

  describe('setArenaSize', () => {
    it('spawns both colonies inside the arena', () => {
      service.setArenaSize(WIDTH, HEIGHT);

      for (const player of playerQuery.getAll()) {
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

      expect(query.getValue().levelId).toBe('serpentine');
    });

    it('gives the crosshairs the speed of the level', () => {
      service.setArenaSize(WIDTH, HEIGHT);

      service.setLevel('serpentine');

      const speed = levelCrosshairSpeed(getLevel('serpentine'));
      for (const player of playerQuery.getAll()) {
        expect(player.maxSpeed).toBe(speed);
      }
    });

    it('paints and names the colonies in the colours the players picked', () => {
      service.setArenaSize(WIDTH, HEIGHT);
      service.setMode('two-players');

      service.setColor(0, 'green');
      service.setColor(1, 'pink');

      const [left, right] = playerQuery.getAll();
      expect([left.name, right.name]).toEqual(['Green', 'Pink']);
      expect(left.color).toEqual([40, 200, 70, 255]);
      expect(right.color).toEqual([255, 70, 170, 255]);
    });

    it('swaps the colours when a seat picks the other one', () => {
      service.setColor(0, 'blue');

      expect(query.getValue().colors).toEqual(['blue', 'orange']);
    });

    it('leaves a running match alone', () => {
      service.setArenaSize(WIDTH, HEIGHT);
      service.start();
      const before = playerQuery.getAll().map((player) => player.maxSpeed);

      service.setLevel('serpentine');

      expect(playerQuery.getAll().map((player) => player.maxSpeed)).toEqual(
        before
      );
      expect(query.getValue().levelId).toBe('serpentine');
    });

    it('keeps the current level for an id that does not exist', () => {
      service.setLevel('serpentine');

      service.setLevel('not-a-level');

      expect(query.getValue().levelId).toBe(getLevel('not-a-level').id);
    });
  });

  describe('setMode', () => {
    it('hands the second crosshair to the computer', () => {
      service.setArenaSize(WIDTH, HEIGHT);

      service.setMode('vs-computer');

      const [human, computer] = playerQuery.getAll();
      expect(query.getValue().mode).toBe('vs-computer');
      expect(human.isBot).toBe(false);
      expect(human.name).toBe('You');
      expect(computer.isBot).toBe(true);
      expect(computer.name).toBe('Computer');
    });

    it('names both humans by colour', () => {
      service.setArenaSize(WIDTH, HEIGHT);

      service.setMode('two-players');

      expect(playerQuery.getAll().map((player) => player.name)).toEqual([
        'Orange',
        'Blue',
      ]);
      expect(playerQuery.getAll().some((player) => player.isBot)).toBe(false);
    });

    it('leaves a running match alone', () => {
      service.setArenaSize(WIDTH, HEIGHT);
      service.setMode('two-players');
      service.start();

      service.setMode('vs-computer');

      expect(playerQuery.getAll().some((player) => player.isBot)).toBe(false);
      expect(query.getValue().mode).toBe('vs-computer');
    });

    it('leaves a paused match alone as well', () => {
      service.setArenaSize(WIDTH, HEIGHT);
      service.setMode('two-players');
      service.start();
      service.togglePause();

      service.setMode('vs-computer');

      expect(playerQuery.getAll().some((player) => player.isBot)).toBe(false);
    });
  });

  describe('setDifficulty', () => {
    it('stores the difficulty', () => {
      service.setDifficulty('hard');

      expect(query.getValue().difficulty).toBe('hard');
    });
  });

  describe('boost', () => {
    it('fires the boost of a running match', () => {
      service.setArenaSize(WIDTH, HEIGHT);
      service.start();

      service.boost(0);

      expect(playerQuery.getEntity(0)?.boostActiveSec).toBeGreaterThan(0);
    });

    it('does nothing on the start screen', () => {
      service.setArenaSize(WIDTH, HEIGHT);

      service.boost(0);

      expect(playerQuery.getEntity(0)?.boostActiveSec).toBe(0);
    });
  });

  describe('head start', () => {
    function startingCounts(): number[] {
      return playerQuery.getAll().map((player) => player.bacteriaCount);
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

      expect(query.getValue().timePassed).toBeCloseTo(3 * TICK_MS);
    });

    it('lands on every second exactly', () => {
      service.setArenaSize(WIDTH, HEIGHT);
      service.init(WIDTH, HEIGHT);
      service.start();

      for (let frame = 0; frame < 60; frame++) {
        service.advance(WIDTH, HEIGHT, 1);
      }

      expect(query.getValue().timePassed).toBe(1000);
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
      expect(query.getValue().timePassed).toBeCloseTo(2 * TICK_MS);
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
      service.start();
      TestBed.inject(GameStateStore).update({ timePassed: 30_000 });
      const [human, other] = playerQuery.getAll();
      const players = TestBed.inject(PlayerStore);
      players.update(human.id, { bacteriaCount: 400, peakCount: 500 });
      players.update(other.id, { bacteriaCount: 0, lost: 300 });
    }

    afterEach(() => service.cleanup());

    it('judges a win against the computer and keeps the award', () => {
      winAgainst('vs-computer');

      const state = query.getValue();
      expect(state.currentState).toBe(GameState.END);
      expect(state.matchEnded).toBe(true);
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

      expect(query.getValue().matchEnded).toBe(true);
      expect(query.getValue().earnings?.award).toBeNull();
    });

    it('keeps the achievements the match earned, in either mode', () => {
      winAgainst('vs-computer');
      expect(query.getValue().earnings?.achievements).toContain('first-blood');

      service.start();
      expect(query.getValue().earnings).toBeNull();
    });

    it('counts a match between two players', () => {
      winAgainst('two-players');

      expect(TestBed.inject(ProgressService).totals().couchMatches).toBe(1);
    });

    it('records what the colonies did against the computer', () => {
      winAgainst('vs-computer');

      expect(query.getValue().earnings?.award?.record).toEqual(
        expect.objectContaining({
          enemyCrushed: 300,
          peakShare: expect.any(Number),
        })
      );
      expect(
        query.getValue().earnings?.award?.record.peakShare
      ).toBeGreaterThan(0);
    });

    it('plays a series between two players to the end', () => {
      service.setSeriesLength(3);
      winAgainst('two-players');
      expect(query.getValue().series?.wins).toEqual([1, 0]);

      winAgainst('two-players');
      expect(query.getValue().series).toEqual({ bestOf: 3, wins: [2, 0] });

      // Taken: the next match starts a new one.
      service.start();
      expect(query.getValue().series?.wins).toEqual([0, 0]);
    });

    it('ends a series when its setup changes, or on request', () => {
      service.setSeriesLength(3);
      winAgainst('two-players');

      service.setColor(0, 'orange');
      expect(query.getValue().series).not.toBeNull();
      service.setHeadStart(1);
      expect(query.getValue().series).toBeNull();

      winAgainst('two-players');
      service.endSeries();
      expect(query.getValue().series).toBeNull();
    });

    it('carries a series from level to level', () => {
      service.setSeriesLength(3);
      winAgainst('two-players');

      service.setLevel('corridors');

      expect(query.getValue().series?.wins).toEqual([1, 0]);
    });

    it('plays single matches without a series', () => {
      winAgainst('two-players');

      expect(query.getValue().series).toBeNull();
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

      expect(query.getValue().timePassed).toBe(0);
    });

    it('forgets the award as the next match starts', () => {
      winAgainst('vs-computer');

      service.start();

      expect(query.getValue().earnings).toBeNull();
    });
  });
});
