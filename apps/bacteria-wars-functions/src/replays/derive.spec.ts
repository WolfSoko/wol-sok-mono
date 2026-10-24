import { Timestamp } from 'firebase-admin/firestore';
import { Engine, loadEngine } from '../engine';
import {
  bytesOf,
  ladderComputerPlan,
  ladderPlan,
  recordedReplay,
} from '../testing/replays';
import { dayOf } from '../time';
import {
  deriveKind,
  inputsHash,
  levelStatsId,
  levelStatsIncrements,
  MAX_SUBMISSION_BYTES,
  parseSubmission,
} from './derive';

const NOW = Date.UTC(2026, 9, 24, 12);

let engine: Engine;

beforeAll(async () => {
  engine = await loadEngine();
});

describe('parseSubmission', () => {
  const valid = () => ({
    uid: 'ana',
    bytes: Buffer.from([1, 2, 3]),
    hint: 42,
    createdAt: Timestamp.fromMillis(NOW),
    expireAt: Timestamp.fromMillis(NOW + 86_400_000),
  });

  it('reads what the rules let through', () => {
    expect(parseSubmission(valid())).toEqual({
      uid: 'ana',
      bytes: Buffer.from([1, 2, 3]),
      hint: 42,
      createdAt: NOW,
    });
    expect(parseSubmission({ ...valid(), attempt: 'd_2026-10-24_1' })).toEqual(
      expect.objectContaining({ attempt: 'd_2026-10-24_1' })
    );
  });

  it.each([
    ['no data', undefined],
    ['no uid', { ...valid(), uid: '' }],
    ['no bytes', { ...valid(), bytes: Buffer.alloc(0) }],
    [
      'bytes over the cap',
      { ...valid(), bytes: Buffer.alloc(MAX_SUBMISSION_BYTES + 1) },
    ],
    ['a string for bytes', { ...valid(), bytes: 'abc' }],
    ['a hint above 100', { ...valid(), hint: 101 }],
    ['no time', { ...valid(), createdAt: NOW }],
    ['an attempt that is no string', { ...valid(), attempt: 1 }],
  ])('refuses %s', (_, data) => {
    expect(
      parseSubmission(data as Record<string, unknown> | undefined)
    ).toBeNull();
  });
});

describe('deriveKind', () => {
  const header = (levelId: string, roomCode?: string) =>
    ({ levelId, ...(roomCode ? { roomCode } : {}) }) as never;
  const today = () => engine.dailyLevelId('2026-10-24');
  const yesterday = () => engine.dailyLevelId('2026-10-23');

  it('calls a match with a room online', () => {
    expect(deriveKind(engine, header('quarantine', 'ABCDEF'), null, NOW)).toBe(
      'online'
    );
  });

  it('calls the daily level of the day of arrival or the day before daily', () => {
    expect(deriveKind(engine, header(today()), null, NOW)).toBe('daily');
    expect(deriveKind(engine, header(yesterday()), null, NOW)).toBe('daily');
    expect(
      deriveKind(engine, header(engine.dailyLevelId('2026-10-20')), null, NOW)
    ).toBe('computer');
  });

  it('takes the day of a daily attempt, and endless from a run', () => {
    const attempt = engine.parseAttemptId('d_2026-10-20_1');
    expect(
      deriveKind(
        engine,
        header(engine.dailyLevelId('2026-10-20')),
        attempt,
        NOW
      )
    ).toBe('daily');
    expect(deriveKind(engine, header(today()), attempt, NOW)).toBe('computer');
    expect(
      deriveKind(
        engine,
        header('gen:field:1:3'),
        engine.parseAttemptId('e_202610241_0'),
        NOW
      )
    ).toBe('endless');
  });

  it('calls anything else a match against the computer', () => {
    expect(deriveKind(engine, header('quarantine'), null, NOW)).toBe(
      'computer'
    );
  });
});

describe('level statistics', () => {
  it('keeps a ladder level by its id and a generated one by style and heat', () => {
    expect(
      levelStatsId({ levelId: 'quarantine', difficulty: 'hard' }, 'computer')
    ).toBe('quarantine_hard');
    expect(
      levelStatsId(
        { levelId: 'gen:field:123456:4', difficulty: 'normal' },
        'computer'
      )
    ).toBe('gen-field-4_normal');
    expect(
      levelStatsId(
        { levelId: 'gen:field:20261024:5', difficulty: 'normal' },
        'daily'
      )
    ).toBe('daily-5_normal');
    expect(
      levelStatsId(
        { levelId: 'gen:maze:99:7', difficulty: 'normal' },
        'endless'
      )
    ).toBe('endless-7_normal');
  });

  it('counts a match: its result, length and quitting, no uid', async () => {
    const replay = await recordedReplay(await ladderPlan());
    expect(
      levelStatsIncrements(
        replay,
        engine.TICKS_PER_SEC,
        engine.isEvolvedReplay(replay.header)
      )
    ).toEqual({
      attempts: 1,
      losses: 1,
      'durations.lt1m': 1,
      quits: 1,
    });
  });

  it('tells evolved wins from plain ones and counts the weapon carried', async () => {
    const replay = await recordedReplay(await ladderPlan());
    const evolved = {
      ...replay,
      header: {
        ...replay.header,
        version: engine.EVOLVED_REPLAY_VERSION,
        ticks: 200 * engine.TICKS_PER_SEC,
        outcome: { endedBy: 'annihilation' as const, winnerSeat: 0 },
        loadouts: [
          { genes: {}, weapon: 'toxin-bomb' },
          { genes: {}, weapon: null },
        ],
      },
    } as never;
    expect(levelStatsIncrements(evolved, engine.TICKS_PER_SEC, true)).toEqual({
      attempts: 1,
      wins: 1,
      'durations.lt5m': 1,
      evolved: 1,
      evolvedWins: 1,
      'weapons.toxin-bomb': 1,
    });
  });
});

describe('inputsHash', () => {
  it('is the same for the same inputs, whatever the header', async () => {
    const replay = await recordedReplay(await ladderPlan());
    const other = { ...replay, header: { ...replay.header, client: 'x' } };
    expect(inputsHash(other)).toBe(inputsHash(replay));
    expect(inputsHash(replay)).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("a match against the ladder's computer (replay version 4)", () => {
  async function stored(plan: Promise<Parameters<typeof recordedReplay>[0]>) {
    const replay = await recordedReplay(await plan);
    return engine.replayFromBytes(new Uint8Array(await bytesOf(replay)), {
      stored: true,
    });
  }

  it('is stored as a match against the computer, and counts as evolved', async () => {
    const replay = await stored(ladderComputerPlan());
    expect(replay?.header).toEqual(
      expect.objectContaining({
        version: engine.LADDER_REPLAY_VERSION,
        ladder: engine.LADDER_VERSION,
        mode: 'vs-computer',
      })
    );
    if (replay === null) {
      throw new Error('not stored');
    }
    expect(deriveKind(engine, replay.header, null, NOW)).toBe('computer');
    expect(engine.isEvolvedReplay(replay.header)).toBe(true);
    expect(
      levelStatsIncrements(
        replay,
        engine.TICKS_PER_SEC,
        engine.isEvolvedReplay(replay.header)
      )
    ).toEqual(expect.objectContaining({ attempts: 1, evolved: 1 }));
  });

  it('is stored on a generated level too, by its style and heat', async () => {
    const levelId = engine.endlessLevelId({ seed: 5, wins: 2, lives: 3 });
    const replay = await stored(ladderComputerPlan(levelId));
    expect(replay?.header.version).toBe(engine.LADDER_REPLAY_VERSION);
    if (replay === null) {
      throw new Error('not stored');
    }
    const kind = deriveKind(engine, replay.header, null, NOW);
    expect(kind).toBe('computer');
    expect(levelStatsId(replay.header, kind)).toMatch(/^gen-[a-z]+-\d+_hard$/);
  });

  it('is never taken for the daily level or a ranked attempt', async () => {
    const daily = engine.dailyLevelId(dayOf(NOW));
    expect(await stored(ladderComputerPlan(daily))).toBeNull();
    const ranked = await recordedReplay(await ladderComputerPlan(), 120, {
      attempt: { id: 'e_202610241_0', at: NOW },
    });
    expect(ranked.header.version).toBe(engine.LADDER_REPLAY_VERSION);
    expect(
      await engine.replayFromBytes(new Uint8Array(await bytesOf(ranked)), {
        stored: true,
      })
    ).toBeNull();
  });
});
