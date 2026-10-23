import { TICKS_PER_SEC } from './fixed-tick';
import { MatchEngine, onGrid, STEER_STEPS } from './match-engine';
import { MatchPlan, planMatch } from './match-setup';
import { MAX_TICKS, Replay, replayOf, ReplaySteer } from './replay';
import {
  MAX_PACKED_BYTES,
  MAX_UNPACKED_BYTES,
  packReplay,
  replayFromBytes,
  replayToBytes,
  unpackReplay,
} from './replay-pack';

const ONLINE: MatchPlan = {
  levelId: 'petri-dish',
  mode: 'two-players',
  difficulty: 'normal',
  colors: ['orange', 'blue'],
  headStart: 0,
  width: 320,
  height: 180,
  seed: 5150,
};

const EXTRAS = {
  roomCode: 'K7QPXM',
  n: 2,
  outcome: { endedBy: 'annihilation' as const, winnerSeat: 0 },
  checksum: 123456789,
  client: '1.2.3',
};

/** Two seconds of a match where both humans steer, drag and boost. */
function played(): Replay {
  const { spawns, options } = planMatch(ONLINE);
  const engine = new MatchEngine(spawns, options);
  for (let tick = 0; tick < 2 * TICKS_PER_SEC; tick++) {
    engine.setSteering(0, { x: Math.cos(tick / 7), y: -0.5 });
    engine.setSteering(1, tick < 30 ? { x: -1, y: 0 } : { x: 0, y: 0 });
    if (tick === 40) {
      engine.setDragTarget(1, 33.3, 120.6);
    }
    if (tick === 50) {
      engine.boost(0);
    }
    engine.tick(ONLINE.width, ONLINE.height);
  }
  return replayOf(ONLINE, 'cpu', engine.tickCount, engine.recorded, EXTRAS);
}

/** An hour of an online match with both sticks moving every tick. */
function hourOfSticks(): Replay {
  const steers: ReplaySteer[] = [];
  for (let tick = 0; tick < MAX_TICKS; tick++) {
    for (const seat of [0, 1]) {
      const angle = tick / (seat === 0 ? 40 : 55);
      steers.push([
        tick,
        seat,
        onGrid(Math.cos(angle), STEER_STEPS),
        onGrid(Math.sin(angle), STEER_STEPS),
      ]);
    }
  }
  return replayOf(
    ONLINE,
    'cpu',
    MAX_TICKS,
    { steers, drags: [], boosts: [] },
    EXTRAS
  );
}

describe('replay packing', () => {
  const replay = played();

  it('packs and unpacks without losing anything', () => {
    const packed = packReplay(replay);

    expect(packed.h).toEqual(replay.header);
    expect(packed.s.every(Number.isInteger)).toBe(true);
    expect(
      unpackReplay(JSON.parse(JSON.stringify(packed)), { stored: true })
    ).toEqual(replay);
  });

  it('leaves the room, the match number and the client out for the public', () => {
    const { h } = packReplay(replay, { forPublic: true });

    expect(h).not.toHaveProperty('roomCode');
    expect(h).not.toHaveProperty('n');
    expect(h).not.toHaveProperty('client');
    expect(h.outcome).toEqual(EXTRAS.outcome);
    expect(h.checksum).toBe(EXTRAS.checksum);
  });

  it('stores a replay as deflated bytes and reads it back', async () => {
    const bytes = await replayToBytes(replay);

    expect(await replayFromBytes(bytes, { stored: true })).toEqual(replay);
  });

  it.each([
    ['no object', 'run'],
    ['no inputs', { h: {} }],
    ['a list cut short', { ...packReplay(played()), s: [1, 0, 3] }],
  ])('unpacks nothing from %s', (_, packed) => {
    expect(unpackReplay(packed)).toBeNull();
  });

  it('fits an hour of both sticks moving every tick into the caps', async () => {
    const hour = hourOfSticks();
    const json = JSON.stringify(packReplay(hour));
    const bytes = await replayToBytes(hour);

    expect(json.length).toBeLessThan(MAX_UNPACKED_BYTES);
    expect(bytes.length).toBeLessThan(MAX_PACKED_BYTES);
    expect(await replayFromBytes(bytes, { stored: true })).toEqual(hour);
  });

  it('reads nothing from bytes over the caps', async () => {
    expect(
      await replayFromBytes(new Uint8Array(MAX_PACKED_BYTES + 1))
    ).toBeNull();

    // Little to store, but too much to unpack.
    const bomb = new TextEncoder().encode(
      `{"h":{},"s":[${'0,'.repeat(MAX_UNPACKED_BYTES / 2)}0]}`
    );
    const packed = await deflate(bomb);
    expect(packed.length).toBeLessThan(MAX_PACKED_BYTES);
    expect(await replayFromBytes(packed)).toBeNull();
  });

  it('reads nothing from bytes that are no replay', async () => {
    expect(await replayFromBytes(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

/** The bytes through deflate-raw, all at once. */
async function deflate(
  bytes: Uint8Array<ArrayBuffer>
): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new CompressionStream('deflate-raw');
  const writer = stream.writable.getWriter();
  writer.write(bytes).catch(() => undefined);
  writer.close().catch(() => undefined);
  const chunks: number[] = [];
  const reader = stream.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      return Uint8Array.from(chunks);
    }
    chunks.push(...value);
  }
}
