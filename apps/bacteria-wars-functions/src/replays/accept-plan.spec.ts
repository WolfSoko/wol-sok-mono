import {
  dailyLevelId,
  onlineReplayId,
  type Replay,
  type ReplayHeader,
} from '@wolsok/feat-lazy-bac-game/engine';
import { planAcceptance, type SubmissionMeta } from './accept-plan';

const DAY_MS = 24 * 3_600_000;
const ARRIVED = Date.UTC(2026, 9, 24, 12);

function replay(header: Partial<ReplayHeader> = {}): Replay {
  return {
    header: {
      version: 2,
      balanceVersion: 6,
      simulation: 'cpu',
      levelId: 'quarantine',
      mode: 'vs-computer',
      difficulty: 'normal',
      colors: ['orange', 'blue'],
      headStart: 0,
      width: 320,
      height: 180,
      seed: 7,
      ticks: 3_600,
      seats: [{ isBot: false }, { isBot: true }],
      outcome: { endedBy: 'annihilation', winnerSeat: 0 },
      checksum: 1234,
      ...header,
    } as ReplayHeader,
    inputs: { steer: [], drag: [], boost: [] } as unknown as Replay['inputs'],
  };
}

const submission = (meta: Partial<SubmissionMeta> = {}): SubmissionMeta => ({
  id: 'sub1',
  uid: 'ada',
  hint: 42,
  createdAt: ARRIVED,
  ...meta,
});

describe('planAcceptance', () => {
  it('stores a match against the computer under the submission id', () => {
    const plan = planAcceptance(replay(), submission());
    expect(plan).toEqual({
      id: 'l_sub1',
      kind: 'computer',
      record: {
        kind: 'computer',
        levelId: 'quarantine',
        balanceVersion: 6,
        replayVersion: 2,
        simulation: 'cpu',
        ticks: 3_600,
        endedBy: 'annihilation',
        winnerSeat: 0,
        checksum: 1234,
        hint: 42,
      },
    });
  });

  it('stores an online match under the id both devices know', () => {
    const plan = planAcceptance(
      replay({
        mode: 'two-players',
        roomCode: 'ABC234',
        n: 2,
        seats: [{ isBot: false }, { isBot: false }],
      }),
      submission()
    );
    expect(plan).toMatchObject({
      id: onlineReplayId('ABC234', 2, 7),
      kind: 'online',
      room: { code: 'ABC234', n: 2 },
    });
  });

  it('refuses a local match that is not against the computer', () => {
    expect(planAcceptance(replay({ mode: 'two-players' }), submission())).toBe(
      'not-vs-computer'
    );
  });

  it('refuses an online match that claims a ranked attempt', () => {
    expect(
      planAcceptance(
        replay({
          mode: 'two-players',
          roomCode: 'ABC234',
          n: 1,
          attempt: { id: 'd_2026-10-24_1', at: ARRIVED },
        }),
        submission({ attempt: 'd_2026-10-24_1' })
      )
    ).toBe('not-two-players');
  });

  it('tells the daily level of the day it arrived, and of the day before', () => {
    for (const day of ['2026-10-24', '2026-10-23']) {
      expect(
        planAcceptance(replay({ levelId: dailyLevelId(day) }), submission())
      ).toMatchObject({ kind: 'daily' });
    }
    expect(
      planAcceptance(
        replay({ levelId: dailyLevelId('2026-10-22') }),
        submission()
      )
    ).toMatchObject({ kind: 'computer' });
  });

  it("takes the daily level of a ranked attempt's own day", () => {
    const attempt = { id: 'd_2026-10-20_1', at: ARRIVED - 4 * DAY_MS };
    expect(
      planAcceptance(
        replay({ levelId: dailyLevelId('2026-10-20'), attempt }),
        submission({ attempt: attempt.id })
      )
    ).toMatchObject({ kind: 'daily', record: { attempt } });
  });

  it('takes an endless run from its attempt', () => {
    const attempt = { id: 'e_202610241_3', at: ARRIVED };
    expect(
      planAcceptance(replay({ attempt }), submission({ attempt: attempt.id }))
    ).toMatchObject({ kind: 'endless' });
  });

  it('refuses an attempt the submission and the replay do not agree on', () => {
    const attempt = { id: 'd_2026-10-24_1', at: ARRIVED };
    expect(planAcceptance(replay({ attempt }), submission())).toBe(
      'attempt-mismatch'
    );
    expect(planAcceptance(replay(), submission({ attempt: attempt.id }))).toBe(
      'attempt-mismatch'
    );
    expect(
      planAcceptance(
        replay({ attempt }),
        submission({ attempt: 'd_2026-10-24_2' })
      )
    ).toBe('attempt-mismatch');
    expect(
      planAcceptance(
        replay({ attempt: { id: 'nonsense', at: ARRIVED } }),
        submission({ attempt: 'nonsense' })
      )
    ).toBe('attempt-mismatch');
  });

  it('refuses a replay without its outcome', () => {
    expect(planAcceptance(replay({ outcome: undefined }), submission())).toBe(
      'no-outcome'
    );
  });
});
