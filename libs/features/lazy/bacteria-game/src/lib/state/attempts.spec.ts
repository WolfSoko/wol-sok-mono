import { arenaSize, ONLINE_SIM_RESOLUTION } from './arena-size';
import {
  attemptExpireAt,
  attemptSeed,
  canDeclare,
  dailyAttemptId,
  declaredBeforeMatch,
  endlessAttemptId,
  endlessRunId,
  isRankedPlan,
  nextDailyAttemptId,
  nextRunId,
  parseAttemptId,
  rankedPlan,
  requiredAttempt,
  submissionDeadline,
} from './attempts';
import { dailyLevelId } from './daily';
import { getLevel, levelSize } from './levels';

const AT = Date.UTC(2026, 9, 23, 14, 5, 0);

describe('declared attempts', () => {
  describe('ids', () => {
    it('writes daily attempts as d_YYYY-MM-DD_n, n from 1 to 3', () => {
      expect(dailyAttemptId('2026-10-23', 1)).toBe('d_2026-10-23_1');
      expect(parseAttemptId('d_2026-10-23_3')).toEqual({
        kind: 'daily',
        day: '2026-10-23',
        n: 3,
      });
      expect(() => dailyAttemptId('2026-10-23', 4)).toThrow(RangeError);
      expect(() => dailyAttemptId('2026-10-23', 0)).toThrow(RangeError);
    });

    it('writes runs as YYYYMMDD + r and their matches as e_<runId>_<i>', () => {
      expect(endlessRunId('2026-10-23', 2)).toBe('202610232');
      expect(endlessAttemptId('202610232', 0)).toBe('e_202610232_0');
      expect(endlessAttemptId('202610232', 999)).toBe('e_202610232_999');
      expect(parseAttemptId('e_202610235_17')).toEqual({
        kind: 'endless',
        runId: '202610235',
        day: '2026-10-23',
        r: 5,
        i: 17,
      });
      expect(() => endlessRunId('2026-10-23', 6)).toThrow(RangeError);
      expect(() => endlessAttemptId('202610232', 1000)).toThrow(RangeError);
    });

    it('refuses ids the rules refuse', () => {
      for (const id of [
        'd_2026-10-23_4',
        'd_2026-10-23_0',
        'd_2026-02-30_1',
        'd_2026-10-23_01',
        'e_202610236_0',
        'e_202610230_0',
        'e_202610231_1000',
        'e_202610231_01',
        'e_20261023_0',
        'e_202602301_0',
        'x_2026-10-23_1',
        '',
      ]) {
        expect(parseAttemptId(id)).toBeNull();
      }
    });

    it('needs the attempt before it', () => {
      expect(requiredAttempt(parse('d_2026-10-23_1'))).toBeNull();
      expect(requiredAttempt(parse('d_2026-10-23_3'))).toBe('d_2026-10-23_2');
      expect(requiredAttempt(parse('e_202610231_0'))).toBeNull();
      expect(requiredAttempt(parse('e_202610233_0'))).toBe('e_202610232_0');
      expect(requiredAttempt(parse('e_202610233_4'))).toBe('e_202610233_3');
    });
  });

  describe('declaring', () => {
    it('allows three daily attempts on the day of the declaration, in order', () => {
      const declared = new Set<string>();

      expect(canDeclare('d_2026-10-23_2', AT, declared)).toBe(false);
      for (let n = 1; n <= 3; n++) {
        const id = nextDailyAttemptId('2026-10-23', declared);
        expect(id).toBe(`d_2026-10-23_${n}`);
        expect(canDeclare(id ?? '', AT, declared)).toBe(true);
        declared.add(id ?? '');
      }
      expect(nextDailyAttemptId('2026-10-23', declared)).toBeNull();
      expect(canDeclare('d_2026-10-23_3', AT, declared)).toBe(false);
      // Not for another day than the server's.
      expect(canDeclare('d_2026-10-22_1', AT, new Set())).toBe(false);
      expect(canDeclare('d_2026-10-24_1', AT, new Set())).toBe(false);
    });

    it('starts at most five runs a day, each after the one before', () => {
      const declared = new Set<string>();

      expect(canDeclare('e_202610232_0', AT, declared)).toBe(false);
      for (let r = 1; r <= 5; r++) {
        const runId = nextRunId('2026-10-23', declared) ?? '';
        expect(runId).toBe(`20261023${r}`);
        expect(canDeclare(endlessAttemptId(runId, 0), AT, declared)).toBe(true);
        declared.add(endlessAttemptId(runId, 0));
      }
      expect(nextRunId('2026-10-23', declared)).toBeNull();
      expect(canDeclare('e_202610236_0', AT, declared)).toBe(false);
    });

    it('starts a run on the day of the declaration, but lets it go past midnight', () => {
      const nextDay = Date.UTC(2026, 9, 24, 0, 10);
      const declared = new Set(['e_202610231_0', 'e_202610231_1']);

      expect(canDeclare('e_202610231_0', nextDay, new Set())).toBe(false);
      expect(canDeclare('e_202610231_2', nextDay, declared)).toBe(true);
      expect(canDeclare('e_202610231_3', nextDay, declared)).toBe(false);
    });

    it('expires an attempt after 31 days', () => {
      expect(attemptExpireAt(AT) - AT).toBe(31 * 86_400_000);
    });
  });

  describe('seed', () => {
    it('is fixed by the player, the attempt and the time of the declaration', () => {
      // Computed once: a change breaks every stored ranked replay.
      expect(attemptSeed('uid1', 'd_2026-10-23_1', AT)).toBe(2500658748);
      expect(attemptSeed('uid2', 'd_2026-10-23_1', AT)).toBe(175832534);
      expect(attemptSeed('uid1', 'd_2026-10-23_2', AT)).toBe(3119868246);
      expect(attemptSeed('uid1', 'd_2026-10-23_1', AT + 1)).toBe(525773083);
      expect(attemptSeed('uid1', 'e_202610231_0', AT)).toBe(526311313);
    });

    it('is a 32-bit unsigned integer', () => {
      for (let i = 0; i < 50; i++) {
        const seed = attemptSeed(`u${i}`, 'e_202610231_0', AT + i);
        expect(Number.isInteger(seed)).toBe(true);
        expect(seed).toBeGreaterThanOrEqual(0);
        expect(seed).toBeLessThan(2 ** 32);
      }
    });
  });

  describe('ranked setup', () => {
    it('plays normal bots, no head start, default colours, on the online grid', () => {
      const levelId = dailyLevelId('2026-10-23');

      expect(rankedPlan(levelId, 1234)).toEqual({
        levelId,
        mode: 'vs-computer',
        difficulty: 'normal',
        colors: ['orange', 'blue'],
        headStart: 0,
        ...arenaSize(ONLINE_SIM_RESOLUTION, levelSize(getLevel(levelId))),
        seed: 1234,
      });
    });

    it('tells a ranked plan from any other', () => {
      const plan = rankedPlan('petri-dish', 7);

      expect(isRankedPlan(plan)).toBe(true);
      for (const change of [
        { difficulty: 'hard' as const },
        { headStart: 1 as const },
        { mode: 'two-players' as const },
        { colors: ['blue', 'orange'] as [string, string] },
        { width: plan.width * 2 },
      ]) {
        expect(isRankedPlan({ ...plan, ...change })).toBe(false);
      }
    });
  });

  describe('timing', () => {
    it('allows the upload until 5 minutes after the match', () => {
      // 5 s countdown + 60 s match (3,600 ticks) + 300 s.
      expect(submissionDeadline(AT, 3_600) - AT).toBe(365_000);
    });

    it('wants the declaration before the match', () => {
      expect(declaredBeforeMatch(AT, 3_600, AT + 60_000)).toBe(true);
      expect(declaredBeforeMatch(AT, 3_600, AT - 60_000)).toBe(true);
      expect(declaredBeforeMatch(AT, 3_600, AT - 60_001)).toBe(false);
    });
  });
});

function parse(id: string): NonNullable<ReturnType<typeof parseAttemptId>> {
  const attempt = parseAttemptId(id);
  if (attempt === null) {
    throw new Error(`Not an attempt id: ${id}`);
  }
  return attempt;
}
