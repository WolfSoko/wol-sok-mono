import { TestBed } from '@angular/core/testing';
import { GameStateQuery } from './game-state.query';
import { GameStateService } from './game-state.service';
import { GameStateStore } from './game.states';
import { getLevel, levelCrosshairSpeed } from './levels';
import { PlayerQuery } from './player.query';

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
});
