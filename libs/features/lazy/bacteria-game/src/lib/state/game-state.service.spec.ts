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
});
