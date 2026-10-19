import { TestBed } from '@angular/core/testing';
import { TICK_SEC, TICKS_PER_SEC } from './fixed-tick';
import { gameBalance } from './game-balance';
import { GameState, GameStateStore } from './game.states';
import { getMap } from './game-maps';
import { PlayerColorArray } from './player.model';
import { PlayerQuery } from './player.query';
import { PlayerService, PlayerSpawn } from './player.service';

const WIDTH = 320;
const HEIGHT = 140;
const ORANGE: PlayerColorArray = [255, 100, 20, 255];
const BLUE: PlayerColorArray = [0, 100, 230, 255];

function spawns(versusComputer: boolean): PlayerSpawn[] {
  return [
    { x: 80, y: 70, color: ORANGE, name: 'You', isBot: false },
    { x: 240, y: 70, color: BLUE, name: 'Computer', isBot: versusComputer },
  ];
}

describe('PlayerService', () => {
  let service: PlayerService;
  let playerQuery: PlayerQuery;
  let store: GameStateStore;

  beforeEach(() => {
    TestBed.resetTestingModule();
    service = TestBed.inject(PlayerService);
    playerQuery = TestBed.inject(PlayerQuery);
    store = TestBed.inject(GameStateStore);
    store.update({
      width: WIDTH,
      height: HEIGHT,
      currentState: GameState.RUNNING,
    });
  });

  /** Runs the game loop for this long, in whole ticks. */
  function run(seconds: number) {
    for (let tick = 0; tick < Math.round(seconds * TICKS_PER_SEC); tick++) {
      service.tick(WIDTH, HEIGHT);
    }
    service.endFrame();
  }

  /** Holds keys down for this long. */
  function hold(keysPressed: string[], seconds: number) {
    store.update({ keysPressed });
    run(seconds);
  }

  it('lays out the moving walls before the match starts', () => {
    service.init(spawns(false), {
      map: getMap('pistons'),
      arena: { width: WIDTH, height: HEIGHT },
    });

    expect(service.getDynamicWalls().length).toBeGreaterThan(0);
  });

  describe('boost', () => {
    beforeEach(() => {
      service.init(spawns(false), { map: getMap('open-field') });
    });

    it('starts the boost and the cooldown together', () => {
      service.boost(0);

      const player = playerQuery.getEntity(0);
      expect(player?.boostActiveSec).toBe(gameBalance.boostDurationSec);
      expect(player?.boostCooldownSec).toBe(gameBalance.boostCooldownSec);
    });

    it('runs the boost down first and leaves the cooldown untouched', () => {
      service.boost(0);

      run(0.5);

      const player = playerQuery.getEntity(0);
      expect(player?.boostActiveSec).toBeCloseTo(
        gameBalance.boostDurationSec - 0.5
      );
      expect(player?.boostCooldownSec).toBe(gameBalance.boostCooldownSec);
    });

    it('starts recharging once the boost is over', () => {
      service.boost(0);
      run(gameBalance.boostDurationSec);

      run(0.5);

      const player = playerQuery.getEntity(0);
      expect(player?.boostActiveSec).toBe(0);
      expect(player?.boostCooldownSec).toBeCloseTo(
        gameBalance.boostCooldownSec - 0.5
      );
    });

    it('refuses a second boost while the first one is still recharging', () => {
      service.boost(0);
      run(gameBalance.boostDurationSec + 0.1);

      service.boost(0);

      expect(playerQuery.getEntity(0)?.boostActiveSec).toBe(0);
    });

    it('allows a boost again after the boost plus the full cooldown', () => {
      service.boost(0);
      run(gameBalance.boostDurationSec);
      run(gameBalance.boostCooldownSec);

      service.boost(0);

      expect(playerQuery.getEntity(0)?.boostActiveSec).toBe(
        gameBalance.boostDurationSec
      );
    });

    it('counts the boosts each player fired, not the refused ones', () => {
      service.boost(0);
      service.boost(0);
      run(gameBalance.boostDurationSec);
      run(gameBalance.boostCooldownSec);
      service.boost(0);

      const [first, second] = playerQuery.getAll();
      expect(first.boostsFired).toBe(2);
      expect(second.boostsFired).toBe(0);
    });

    it('reports each fired boost once, for its sound', () => {
      service.boost(0);
      service.boost(0);

      run(TICK_SEC);
      expect(service.getFrameEvents().boosts).toEqual([false]);
      run(TICK_SEC);
      expect(service.getFrameEvents().boosts).toEqual([]);
    });

    it('leaves the other player alone', () => {
      service.boost(0);

      expect(playerQuery.getEntity(1)?.boostActiveSec).toBe(0);
    });
  });

  describe('against the computer', () => {
    beforeEach(() => {
      service.init(spawns(true), {
        map: getMap('open-field'),
        difficulty: 'hard',
      });
    });

    it('marks the second player as the bot', () => {
      expect(playerQuery.getEntity(0)?.isBot).toBe(false);
      expect(playerQuery.getEntity(1)?.isBot).toBe(true);
      expect(playerQuery.getEntity(1)?.name).toBe('Computer');
    });

    it('steers the computer crosshair on its own', () => {
      const before = playerQuery.getEntity(1) as { x: number; y: number };

      run(1);

      const after = playerQuery.getEntity(1) as { x: number; y: number };
      expect(after.x !== before.x || after.y !== before.y).toBe(true);
    });

    it('lets the human steer with the arrow keys as well', () => {
      const before = playerQuery.getEntity(0)?.x ?? 0;

      hold(['ArrowRight'], 0.1);

      expect(playerQuery.getEntity(0)?.x).toBeGreaterThan(before);
    });

    it('keeps the keys away from the computer crosshair', () => {
      // Within its first reaction the bot heads for one target either way.
      const botAfter = (keysPressed: string[]) => {
        service.init(spawns(true), { map: getMap('open-field'), seed: 5 });
        hold(keysPressed, 0.2);
        return playerQuery.getEntity(1)?.x;
      };

      const steered = botAfter(['ArrowRight']);
      expect(steered).not.toBe(spawns(true)[1].x);
      expect(steered).toBe(botAfter([]));
    });
  });

  describe('with two humans', () => {
    beforeEach(() => {
      service.init(spawns(false), { map: getMap('open-field') });
    });

    it('gives the arrow keys to the second player', () => {
      const first = playerQuery.getEntity(0)?.x ?? 0;
      const second = playerQuery.getEntity(1)?.x ?? 0;

      hold(['ArrowRight'], 0.1);

      expect(playerQuery.getEntity(0)?.x).toBe(first);
      expect(playerQuery.getEntity(1)?.x).toBeGreaterThan(second);
    });

    it('leaves both crosshairs where they are without a bot', () => {
      const before = playerQuery.getAll().map((player) => [player.x, player.y]);

      run(1 / 3);

      expect(
        playerQuery.getAll().map((player) => [player.x, player.y])
      ).toEqual(before);
    });

    it('moves a diagonal no faster than a straight line', () => {
      const start = playerQuery.getEntity(0) as { x: number; y: number };

      hold(['d', 's'], 0.1);

      const after = playerQuery.getEntity(0) as { x: number; y: number };
      const travelled = Math.hypot(after.x - start.x, after.y - start.y);
      expect(travelled).toBeCloseTo(150 * 0.1);
      expect(after.x - start.x).toBeCloseTo(after.y - start.y);
    });
  });

  describe('joystick', () => {
    beforeEach(() => {
      service.init(spawns(false), { map: getMap('open-field') });
    });

    function positionOf(playerId: number): { x: number; y: number } {
      const { x, y } = playerQuery.getEntity(playerId) as {
        x: number;
        y: number;
      };
      return { x, y };
    }

    it('keeps the crosshair moving while the stick is held', () => {
      const start = positionOf(1);
      service.setSteering(1, { x: 0, y: 1 });

      run(0.2);

      const after = positionOf(1);
      expect(after.x).toBe(start.x);
      expect(after.y).toBeCloseTo(start.y + 150 * 0.2);
    });

    it('moves slower for a gentle push', () => {
      const start = positionOf(0);
      service.setSteering(0, { x: 0.5, y: 0 });

      run(0.1);

      expect(positionOf(0).x).toBeCloseTo(start.x + 150 * 0.1 * 0.5);
    });

    it('stops once the stick is released', () => {
      service.setSteering(0, { x: 1, y: 0 });
      run(0.1);
      const held = positionOf(0);

      service.setSteering(0, { x: 0, y: 0 });
      run(0.1);

      expect(positionOf(0)).toEqual(held);
    });

    it('steers only its own crosshair', () => {
      const other = positionOf(1);
      service.setSteering(0, { x: 1, y: 0 });

      run(0.1);

      expect(positionOf(1)).toEqual(other);
    });

    it('wins over a drag target', () => {
      service.setDragTarget(0, 0, 70);
      service.setSteering(0, { x: 1, y: 0 });
      const start = positionOf(0);

      run(0.1);

      expect(positionOf(0).x).toBeGreaterThan(start.x);
    });

    it('is forgotten when the next match starts', () => {
      service.setSteering(0, { x: 1, y: 0 });

      service.init(spawns(false), { map: getMap('open-field') });
      const start = positionOf(0);
      run(0.1);

      expect(positionOf(0)).toEqual(start);
    });
  });

  describe('match stats', () => {
    it('keeps each colony’s peak and lowest size against the other', () => {
      service.init(spawns(true), {
        map: getMap('open-field'),
        arena: { width: WIDTH, height: HEIGHT },
      });
      const peaks: number[] = [];
      for (let second = 0; second < 5; second++) {
        run(1);
        peaks.push(playerQuery.getAll()[0].bacteriaCount);
      }

      const [human, computer] = playerQuery.getAll();
      expect(human.peakCount).toBeGreaterThanOrEqual(Math.max(...peaks));
      for (const player of [human, computer]) {
        expect(player.lowestSizeRatio).toBeGreaterThan(0);
        expect(player.lowestSizeRatio).toBeLessThanOrEqual(1);
      }
      // The smaller colony fell behind the bigger one at some point.
      expect(
        Math.min(human.lowestSizeRatio, computer.lowestSizeRatio)
      ).toBeLessThan(1);
    });

    it('starts every match from scratch', () => {
      service.init(spawns(false), { map: getMap('open-field') });
      service.boost(0);
      run(1);

      service.init(spawns(false), { map: getMap('open-field') });

      const [player] = playerQuery.getAll();
      expect(player.boostsFired).toBe(0);
      expect(player.lowestSizeRatio).toBe(1);
      expect(player.peakCount).toBe(player.bacteriaCount);
    });
  });

  describe('ticks', () => {
    it('draws a crosshair ahead along its last step, between the ticks', () => {
      service.init(spawns(false), { map: getMap('open-field') });
      const start = playerQuery.getEntity(0)?.x ?? 0;

      hold(['d'], TICK_SEC);

      const player = playerQuery.getAll()[0];
      const step = player.x - start;
      expect(step).toBeGreaterThan(0);
      expect(service.crosshairAt(player, 0).x).toBeCloseTo(player.x);
      expect(service.crosshairAt(player, 0.5).x).toBeCloseTo(
        player.x + step / 2
      );
    });

    it('keeps a crosshair drawn ahead inside the arena', () => {
      service.init(spawns(false), { map: getMap('open-field') });

      hold(['d'], 2);

      const player = playerQuery.getAll()[0];
      expect(player.x).toBe(WIDTH);
      expect(service.crosshairAt(player, 0.9).x).toBe(WIDTH);
    });

    it('draws a fresh crosshair where it stands', () => {
      service.init(spawns(false), { map: getMap('open-field') });
      const player = playerQuery.getAll()[0];

      expect(service.crosshairAt(player, 0.5)).toEqual({
        x: player.x,
        y: player.y,
      });
    });

    it('adds up the events of all ticks of a frame', () => {
      service.init(spawns(true), {
        map: getMap('open-field'),
        arena: { width: WIDTH, height: HEIGHT },
        seed: 3,
      });
      let oneByOne = 0;
      for (let tick = 0; tick < 3 * TICKS_PER_SEC; tick++) {
        run(TICK_SEC);
        oneByOne += service.getFrameEvents().captures;
      }

      service.init(spawns(true), {
        map: getMap('open-field'),
        arena: { width: WIDTH, height: HEIGHT },
        seed: 3,
      });
      run(3);

      expect(oneByOne).toBeGreaterThan(0);
      expect(service.getFrameEvents().captures).toBe(oneByOne);
    });
  });

  describe('seed', () => {
    /** Plays a few seconds against the hard bot, the human idle. */
    function play(seed: number): number[][] {
      service.init(spawns(true), {
        map: getMap('open-field'),
        arena: { width: WIDTH, height: HEIGHT },
        difficulty: 'hard',
        seed,
      });
      run(4);
      return playerQuery
        .getAll()
        .map((player) => [
          player.x,
          player.y,
          player.bacteriaCount,
          player.captured,
          player.boostsFired,
        ]);
    }

    it('plays the same match from the same seed', () => {
      expect(play(42)).toEqual(play(42));
    });

    it('plays another match from another seed', () => {
      expect(play(42)).not.toEqual(play(43));
    });
  });
});
