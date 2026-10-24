import { TestBed } from '@angular/core/testing';
import { TICK_SEC, TICKS_PER_SEC } from './fixed-tick';
import { gameBalance } from './game-balance';
import { GameState, GameStateStore } from './game.states';
import { getMap } from './game-maps';
import { Lockstep } from '../net/lockstep';
import { MatchPlan, planMatch } from './match-setup';
import { PlayerColorArray } from './player.model';
import { PlayerStore } from './player.store';
import { PlayerService, PlayerSpawn } from './player.service';
import { BacteriaSimulation } from './bacteria-simulation';
import { IntSimulation } from './gpu-int/int-simulation';
import { SimulationFactory } from './simulation';

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
  let playerStore: PlayerStore;
  let store: GameStateStore;

  beforeEach(() => {
    TestBed.resetTestingModule();
    service = TestBed.inject(PlayerService);
    playerStore = TestBed.inject(PlayerStore);
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

  describe('simulation', () => {
    const failing: SimulationFactory = () => {
      throw new Error('No GPU here');
    };

    beforeEach(() => {
      jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    it('falls back to the CPU simulation when the GPU one fails', () => {
      service.useSimulation(failing);
      service.init(spawns(false), { arena: { width: WIDTH, height: HEIGHT } });

      expect(service.getSimulation()).toBeInstanceOf(BacteriaSimulation);
    });

    it('falls back to the fallback it was given - the deterministic one', () => {
      service.useSimulation(
        failing,
        (balance, random, seed) => new IntSimulation(balance, random, seed)
      );
      service.init(spawns(false), { arena: { width: WIDTH, height: HEIGHT } });

      expect(service.getSimulation()).toBeInstanceOf(IntSimulation);
    });
  });

  describe('online', () => {
    // Even a plan that carries loadouts - which online never does.
    const plan: MatchPlan = {
      levelId: 'meltdown',
      mode: 'vs-computer',
      difficulty: 'normal',
      colors: ['orange', 'blue'],
      headStart: 0,
      width: WIDTH,
      height: HEIGHT,
      seed: 7,
      loadouts: [
        { genes: {}, weapon: 'toxin-bomb' },
        { genes: {}, weapon: 'cryo-pulse' },
      ],
    };

    it('spawns every seat unarmed, whatever the plan carries', () => {
      const lockstep = new Lockstep(0, () => undefined);
      const { spawns } = planMatch(plan, null, {
        seat: 0,
        drivers: lockstep.drivers(),
      });

      service.init(spawns, { lockstep });

      expect(playerStore.entities().map(({ weapon }) => weapon)).toEqual([
        null,
        null,
      ]);
    });

    it('fires no weapon, even from an armed seat: the lockstep plays them all', () => {
      const lockstep = new Lockstep(0, () => undefined);
      service.init(
        spawns(false).map((spawn) => ({ ...spawn, weapon: 'toxin-bomb' })),
        {
          arena: { width: WIDTH, height: HEIGHT },
          ghosts: lockstep.drivers(),
          lockstep,
        }
      );

      service.fireWeapon(0);

      expect(playerStore.entities()[0].weaponsFired).toBe(0);
    });
  });

  describe('boost', () => {
    beforeEach(() => {
      service.init(spawns(false), { map: getMap('open-field') });
    });

    it('starts the boost and the cooldown together', () => {
      service.boost(0);

      const player = playerStore.entityMap()[0];
      expect(player?.boostActiveSec).toBe(gameBalance.boostDurationSec);
      expect(player?.boostCooldownSec).toBe(gameBalance.boostCooldownSec);
    });

    it('runs the boost down first and leaves the cooldown untouched', () => {
      service.boost(0);

      run(0.5);

      const player = playerStore.entityMap()[0];
      expect(player?.boostActiveSec).toBeCloseTo(
        gameBalance.boostDurationSec - 0.5
      );
      expect(player?.boostCooldownSec).toBe(gameBalance.boostCooldownSec);
    });

    it('starts recharging once the boost is over', () => {
      service.boost(0);
      run(gameBalance.boostDurationSec);

      run(0.5);

      const player = playerStore.entityMap()[0];
      expect(player?.boostActiveSec).toBe(0);
      expect(player?.boostCooldownSec).toBeCloseTo(
        gameBalance.boostCooldownSec - 0.5
      );
    });

    it('refuses a second boost while the first one is still recharging', () => {
      service.boost(0);
      run(gameBalance.boostDurationSec + 0.1);

      service.boost(0);

      expect(playerStore.entityMap()[0]?.boostActiveSec).toBe(0);
    });

    it('allows a boost again after the boost plus the full cooldown', () => {
      service.boost(0);
      run(gameBalance.boostDurationSec);
      run(gameBalance.boostCooldownSec);

      service.boost(0);

      expect(playerStore.entityMap()[0]?.boostActiveSec).toBe(
        gameBalance.boostDurationSec
      );
    });

    it('counts the boosts each player fired, not the refused ones', () => {
      service.boost(0);
      service.boost(0);
      run(gameBalance.boostDurationSec);
      run(gameBalance.boostCooldownSec);
      service.boost(0);

      const [first, second] = playerStore.entities();
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

      expect(playerStore.entityMap()[1]?.boostActiveSec).toBe(0);
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
      expect(playerStore.entityMap()[0]?.isBot).toBe(false);
      expect(playerStore.entityMap()[1]?.isBot).toBe(true);
      expect(playerStore.entityMap()[1]?.name).toBe('Computer');
    });

    it('steers the computer crosshair on its own', () => {
      const before = playerStore.entityMap()[1] as { x: number; y: number };

      run(1);

      const after = playerStore.entityMap()[1] as { x: number; y: number };
      expect(after.x !== before.x || after.y !== before.y).toBe(true);
    });

    it('lets the human steer with the arrow keys as well', () => {
      const before = playerStore.entityMap()[0]?.x ?? 0;

      hold(['ArrowRight'], 0.1);

      expect(playerStore.entityMap()[0]?.x).toBeGreaterThan(before);
    });

    it('keeps the keys away from the computer crosshair', () => {
      // Within its first reaction the bot heads for one target either way.
      const botAfter = (keysPressed: string[]) => {
        service.init(spawns(true), { map: getMap('open-field'), seed: 5 });
        hold(keysPressed, 0.2);
        return playerStore.entityMap()[1]?.x;
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
      const first = playerStore.entityMap()[0]?.x ?? 0;
      const second = playerStore.entityMap()[1]?.x ?? 0;

      hold(['ArrowRight'], 0.1);

      expect(playerStore.entityMap()[0]?.x).toBe(first);
      expect(playerStore.entityMap()[1]?.x).toBeGreaterThan(second);
    });

    it('leaves both crosshairs where they are without a bot', () => {
      const before = playerStore
        .entities()
        .map((player) => [player.x, player.y]);

      run(1 / 3);

      expect(
        playerStore.entities().map((player) => [player.x, player.y])
      ).toEqual(before);
    });

    it('moves a diagonal no faster than a straight line', () => {
      const start = playerStore.entityMap()[0] as { x: number; y: number };

      hold(['d', 's'], 0.1);

      const after = playerStore.entityMap()[0] as { x: number; y: number };
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
      const { x, y } = playerStore.entityMap()[playerId] as {
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
        peaks.push(playerStore.entities()[0].bacteriaCount);
      }

      const [human, computer] = playerStore.entities();
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

      const [player] = playerStore.entities();
      expect(player.boostsFired).toBe(0);
      expect(player.lowestSizeRatio).toBe(1);
      expect(player.peakCount).toBe(player.bacteriaCount);
    });
  });

  describe('ticks', () => {
    it('draws a crosshair ahead along its last step, between the ticks', () => {
      service.init(spawns(false), { map: getMap('open-field') });
      const start = playerStore.entityMap()[0]?.x ?? 0;

      hold(['d'], TICK_SEC);

      const player = playerStore.entities()[0];
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

      const player = playerStore.entities()[0];
      expect(player.x).toBe(WIDTH);
      expect(service.crosshairAt(player, 0.9).x).toBe(WIDTH);
    });

    it('draws a fresh crosshair where it stands', () => {
      service.init(spawns(false), { map: getMap('open-field') });
      const player = playerStore.entities()[0];

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
      return playerStore
        .entities()
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
