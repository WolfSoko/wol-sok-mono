import { Timestamp } from 'firebase-admin/firestore';
import { Engine, loadEngine } from '../engine';
import type { DailyAttemptRow, EndlessRunDoc, RunMatch } from './model';
import { bestRow, computeRun, rankedKind, stateAfterRerun } from './ranked';

describe('ranked days and runs', () => {
  let engine: Engine;
  const NOW = Date.parse('2026-10-24T12:00:00Z');
  const HOUR = 3_600_000;

  beforeAll(async () => {
    engine = await loadEngine();
  });

  describe('bestRow', () => {
    const row = (extra: Partial<DailyAttemptRow>): DailyAttemptRow => ({
      attemptId: 'd_2026-10-24_1',
      replayId: 'l_a',
      sort: 1,
      ticks: 100,
      won: false,
      atHour: 0,
      balanceVersion: engine.BALANCE_VERSION,
      state: 'provisional',
      ...extra,
    });

    it('takes the best attempt that has not failed verification', () => {
      expect(
        bestRow(engine, [
          row({ replayId: 'a', sort: 5 }),
          row({ replayId: 'b', sort: 9, state: 'failed' }),
          row({ replayId: 'c', sort: 7, state: 'verified' }),
        ])?.replayId
      ).toBe('c');
      expect(bestRow(engine, [row({ state: 'failed' })])).toBeNull();
    });
  });

  describe('computeRun', () => {
    let seed: number;

    beforeAll(() => {
      seed = 12345;
    });

    const level = (wins: number) => engine.endlessAttemptLevel(seed, wins);
    const run = (matches: Partial<RunMatch & Record<string, unknown>>[]) =>
      ({
        uid: 'ana',
        runId: '202610241',
        seed,
        matches: matches.map((match, index) => ({
          index,
          attemptId: `e_202610241_${index}`,
          at: NOW - 3 * HOUR,
          replayId: null,
          state: 'open',
          ...match,
        })),
        claimedDepth: 0,
        verifiedWins: 0,
        depth: 0,
        seconds: 0,
        status: 'provisional',
        going: true,
        nextCloseAt: null,
        best: false,
        updatedAt: Timestamp.fromMillis(NOW),
      }) as EndlessRunDoc;
    const won = (wins: number, extra = {}) => ({
      replayId: `l_w${wins}`,
      levelId: level(wins),
      ticks: 60 * 90,
      won: true,
      balanceVersion: engine.BALANCE_VERSION,
      ...extra,
    });
    const lostMatch = (wins: number) => ({
      replayId: `l_l${wins}`,
      levelId: level(wins),
      ticks: 60 * 40,
      won: false,
      balanceVersion: engine.BALANCE_VERSION,
    });

    it('counts the wins before the third lost life and their seconds', () => {
      const doc = run([won(0), lostMatch(1), won(1), {}, lostMatch(2), won(2)]);
      expect(computeRun(engine, doc, new Set(), NOW).size).toBe(0);
      expect(doc.matches.map((match) => match.state)).toEqual([
        'won',
        'lost',
        'won',
        'lost',
        'lost',
        'after',
      ]);
      expect(doc.depth).toBe(2);
      expect(doc.seconds).toBe(180);
      expect(doc.going).toBe(false);
      expect(doc.status).toBe('provisional');
    });

    it('waits on an open match before checking the levels after it', () => {
      const doc = run([won(0), { at: NOW - HOUR }, won(2)]);
      computeRun(engine, doc, new Set(), NOW);
      expect(doc.matches.map((match) => match.state)).toEqual([
        'won',
        'open',
        'after',
      ]);
      expect(doc.depth).toBe(1);
      expect(doc.nextCloseAt?.toMillis()).toBe(NOW + HOUR);
    });

    it('keeps a match with a pending submission open', () => {
      const doc = run([won(0), {}]);
      computeRun(engine, doc, new Set(['e_202610241_1']), NOW);
      expect(doc.matches[1].state).toBe('open');
      expect(doc.nextCloseAt?.toMillis()).toBe(NOW + HOUR);
    });

    it('takes a level that does not follow from the run as a lost life', () => {
      const doc = run([won(0), won(0, { replayId: 'l_bad' })]);
      expect([...computeRun(engine, doc, new Set(), NOW)]).toEqual([
        ['l_bad', 'level-mismatch'],
      ]);
      expect(doc.matches[1].state).toBe('lost');
      expect(doc.depth).toBe(1);
    });

    it('skips void matches', () => {
      const doc = run([won(0), { state: 'void' }, won(1)]);
      computeRun(engine, doc, new Set(), NOW);
      expect(doc.depth).toBe(2);
    });

    it('is verified once every win is, and cut at a win that failed', () => {
      const doc = run([
        won(0, { verified: true }),
        won(1, { verified: true }),
        won(2),
      ]);
      computeRun(engine, doc, new Set(), NOW);
      expect([doc.verifiedWins, doc.status]).toEqual([2, 'provisional']);
      doc.matches[2] = { ...doc.matches[2], failed: true } as RunMatch;
      computeRun(engine, doc, new Set(), NOW);
      expect(doc.cutAt).toBe(2);
      expect([doc.depth, doc.verifiedWins, doc.status, doc.going]).toEqual([
        2,
        2,
        'verified',
        false,
      ]);
    });

    it('turns stale when an unverified win is from an older balance', () => {
      const doc = run([won(0, { balanceVersion: -1 })]);
      computeRun(engine, doc, new Set(), NOW);
      expect(doc.status).toBe('stale');
    });
  });

  it('maps a re-run to the attempt state and a replay to its board', () => {
    expect(stateAfterRerun('verified')).toBe('verified');
    expect(stateAfterRerun('unverified')).toBe('failed');
    expect(stateAfterRerun('balance-mismatch')).toBe('failed');
    expect(
      rankedKind(engine, { attempt: { id: 'd_2026-10-24_1', at: 0 } })
    ).toBe('daily');
    expect(
      rankedKind(engine, { attempt: { id: 'e_202610241_3', at: 0 } })
    ).toBe('endless');
    expect(rankedKind(engine, {})).toBeNull();
  });
});
