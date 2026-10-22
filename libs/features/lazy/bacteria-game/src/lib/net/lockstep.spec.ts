import { MatchEngine } from '../state/match-engine';
import { MatchPlan, planMatch } from '../state/match-setup';
import { createPlayer } from '../state/player.model';
import {
  CHECK_EVERY_TICKS,
  INPUT_DELAY_TICKS,
  Lockstep,
  matchChecksum,
} from './lockstep';
import { LockstepMessage } from './net-message';

const PLAN: MatchPlan = {
  levelId: 'petri-dish',
  mode: 'two-players',
  difficulty: 'normal',
  colors: ['orange', 'blue'],
  headStart: 0,
  width: 320,
  height: 180,
  seed: 4321,
};

/** One device of an online match: its lockstep, its engine, its outbox. */
interface Device {
  lockstep: Lockstep;
  engine: MatchEngine;
  outbox: LockstepMessage[];
}

function device(seat: 0 | 1): Device {
  const outbox: LockstepMessage[] = [];
  const lockstep = new Lockstep(seat, (message) => outbox.push(message));
  const { spawns, options } = planMatch(PLAN, null, {
    seat,
    drivers: lockstep.drivers(),
  });
  return { lockstep, engine: new MatchEngine(spawns, options), outbox };
}

/** Hands what `from` sent to `to`, as the connection would. */
function deliver(from: Device, to: Device): void {
  for (const message of from.outbox.splice(0)) {
    if (message.k === 'in') {
      to.lockstep.putRemote(message.t, message);
    } else {
      to.lockstep.putRemoteSum(message.t, message.h);
    }
  }
}

/** Plays a tick on a device where the lockstep lets it - true if it did. */
function step(
  { lockstep, engine }: Device,
  push: { x: number; y: number },
  boost = false
): boolean {
  if (!lockstep.ready(engine.tickCount)) {
    return false;
  }
  lockstep.putLocal(engine.tickCount, push, null, boost);
  engine.tick(PLAN.width, PLAN.height);
  lockstep.ticked(engine.tickCount, engine.players);
  return true;
}

describe('Lockstep', () => {
  it('plays the same match on both devices', () => {
    const host = device(0);
    const guest = device(1);
    // The guest lags behind by a few ticks, as it would over the network.
    for (let frame = 0; frame < 600; frame++) {
      step(host, { x: 1, y: frame < 200 ? 0.5 : -0.5 }, frame === 120);
      if (frame >= 3) {
        step(guest, { x: -1, y: 0 }, frame === 300);
      }
      deliver(host, guest);
      deliver(guest, host);
    }
    while (guest.engine.tickCount < host.engine.tickCount) {
      step(guest, { x: -1, y: 0 });
      deliver(guest, host);
    }

    expect(host.engine.tickCount).toBeGreaterThan(500);
    expect(guest.engine.players).toEqual(
      host.engine.players.map((player, seat) => ({
        ...player,
        // Only how each device names and treats the other one differs.
        name: seat === 1 ? 'You' : 'Opponent',
        isBot: seat === 0,
      }))
    );
    expect(host.engine.players[0].boostsFired).toBe(1);
    expect(host.engine.players[1].boostsFired).toBe(1);
    expect(host.lockstep.desynced).toBe(false);
    expect(guest.lockstep.desynced).toBe(false);
  });

  it('waits for the other device after the delay', () => {
    const host = device(0);
    for (let tick = 0; tick < INPUT_DELAY_TICKS; tick++) {
      expect(step(host, { x: 0, y: 0 })).toBe(true);
    }

    expect(step(host, { x: 0, y: 0 })).toBe(false);
    host.lockstep.putRemote(INPUT_DELAY_TICKS, {
      steer: [0, 0],
      drag: null,
      boost: false,
    });
    expect(step(host, { x: 0, y: 0 })).toBe(true);
  });

  it('plays its own input after the delay', () => {
    const host = device(0);
    const start = host.engine.players[0];

    step(host, { x: 1, y: 0 });
    for (let tick = 1; tick < INPUT_DELAY_TICKS; tick++) {
      step(host, { x: 0, y: 0 });
    }
    expect(host.engine.players[0].x).toBe(start.x);
    host.lockstep.putRemote(INPUT_DELAY_TICKS, {
      steer: [0, 0],
      drag: null,
      boost: false,
    });
    step(host, { x: 0, y: 0 });

    expect(host.engine.players[0].x).toBeGreaterThan(start.x);
  });

  it('sends its inputs on the input grid, a key and a stick no harder than one', () => {
    const outbox: LockstepMessage[] = [];
    const lockstep = new Lockstep(1, (message) => outbox.push(message));

    lockstep.putLocal(10, { x: 2, y: 0.33 }, { x: 10.3, y: 4.1 }, true);

    expect(outbox).toEqual([
      {
        k: 'in',
        t: 10 + INPUT_DELAY_TICKS,
        steer: [1, 0.1875],
        drag: [10.25, 4],
        boost: true,
      },
    ]);
  });

  it('finds out when the two devices fell out of step', () => {
    const outbox: LockstepMessage[] = [];
    const lockstep = new Lockstep(0, (message) => outbox.push(message));
    const players = [createPlayer({ bacteriaCount: 10 })];

    lockstep.ticked(CHECK_EVERY_TICKS, players);
    lockstep.putRemoteSum(CHECK_EVERY_TICKS, matchChecksum(players));
    expect(lockstep.desynced).toBe(false);

    lockstep.putRemoteSum(2 * CHECK_EVERY_TICKS, 12345);
    lockstep.ticked(2 * CHECK_EVERY_TICKS, players);
    expect(lockstep.desynced).toBe(true);
    expect(outbox.filter((message) => message.k === 'sum')).toHaveLength(2);
  });
});

describe('matchChecksum', () => {
  it('changes with the colonies', () => {
    const a = createPlayer({ id: 0, bacteriaCount: 10 });

    expect(matchChecksum([a])).toBe(matchChecksum([{ ...a }]));
    expect(matchChecksum([a])).not.toBe(
      matchChecksum([{ ...a, bacteriaCount: 11 }])
    );
  });
});
