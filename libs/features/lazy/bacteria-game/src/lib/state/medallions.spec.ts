import { aMatchRecord } from '../../testing/match-record';
import {
  betterMedal,
  judgeMatch,
  MatchRecord,
  matchRecord,
  MedalLimits,
  medalFor,
  medalGoal,
} from './medallions';
import { createPlayer } from './player.model';

const LIMITS: MedalLimits = { silverSec: 60, goldSec: 40, goldLossShare: 0.3 };

/** A flawless win, which the tests take apart one condition at a time. */
const PLATINUM_RUN = aMatchRecord({
  durationSec: 30,
  lost: 10,
  lowestSizeRatio: 0.9,
  captured: 800,
  enemyCrushed: 100,
  peakShare: 0.5,
});

function run(changes: Partial<MatchRecord>): MatchRecord {
  return { ...PLATINUM_RUN, ...changes };
}

describe('medalFor', () => {
  it('gives nothing for a match that was not won', () => {
    expect(medalFor(LIMITS, run({ won: false }))).toBeNull();
  });

  it('gives bronze for a slow win', () => {
    expect(medalFor(LIMITS, run({ durationSec: 61 }))).toBe('bronze');
  });

  it('gives silver for a win within the silver time', () => {
    expect(medalFor(LIMITS, run({ durationSec: 60 }))).toBe('silver');
  });

  it('holds gold back from a fast win that lost too much', () => {
    expect(medalFor(LIMITS, run({ lost: 300 }))).toBe('silver');
  });

  it('gives gold for a fast, clean win with a boost', () => {
    expect(medalFor(LIMITS, run({ boostsFired: 1 }))).toBe('gold');
  });

  it('gives gold for a win that fell below half the computer', () => {
    expect(medalFor(LIMITS, run({ lowestSizeRatio: 0.4 }))).toBe('gold');
  });

  it('gives platinum for a flawless win', () => {
    expect(medalFor(LIMITS, PLATINUM_RUN)).toBe('platinum');
  });

  it('lowers the platinum bar where a level sets it - against a boss', () => {
    const boss = { ...LIMITS, platinumSizeRatio: 0.3 };

    expect(medalFor(boss, run({ lowestSizeRatio: 0.4 }))).toBe('platinum');
    expect(medalFor(boss, run({ lowestSizeRatio: 0.2 }))).toBe('gold');
  });

  it('never skips a tier: a slow flawless win is bronze', () => {
    expect(medalFor(LIMITS, run({ durationSec: 90 }))).toBe('bronze');
  });
});

describe('judgeMatch', () => {
  const medalHint = (limits: MedalLimits, record: MatchRecord) =>
    judgeMatch(limits, record).hint;

  it('hands out the medallion medalFor gives', () => {
    expect(judgeMatch(LIMITS, run({ boostsFired: 1 })).medal).toBe('gold');
  });

  it('asks a lost match for a win', () => {
    expect(medalHint(LIMITS, run({ won: false }))).toBe('Bronze needs a win.');
  });

  it('says how much faster silver would have been', () => {
    expect(medalHint(LIMITS, run({ durationSec: 72.2 }))).toBe(
      'Silver needs a win 13 s faster.'
    );
  });

  it('names the losses that held gold back', () => {
    expect(medalHint(LIMITS, run({ lost: 420 }))).toBe(
      'Gold needs a cleaner win - losses under 30 % of your peak colony, you had 42 %.'
    );
  });

  it('names the boost that held platinum back', () => {
    expect(medalHint(LIMITS, run({ boostsFired: 2 }))).toBe(
      'Platinum needs a gold win without a boost.'
    );
  });

  it('names the size platinum asks never to fall below', () => {
    expect(medalHint(LIMITS, run({ lowestSizeRatio: 0.3 }))).toBe(
      'Platinum needs a gold win that never falls below 50 % of the computer’s size.'
    );
  });

  it('has nothing left to ask after platinum', () => {
    expect(medalHint(LIMITS, PLATINUM_RUN)).toBeNull();
  });
});

describe('matchRecord', () => {
  const human = createPlayer({
    id: 0,
    isBot: false,
    lost: 120,
    boostsFired: 2,
    peakCount: 300,
    lowestSizeRatio: 0.4,
    captured: 250,
    pellets: 7,
  });
  const computer = createPlayer({ id: 1, isBot: true, lost: 270 });
  const match = {
    levelId: 'hourglass',
    difficulty: 'hard' as const,
    capacity: 600,
  };

  it('takes what the human did from their player', () => {
    expect(
      matchRecord([human, computer], {
        ...match,
        durationSec: 42,
        winner: human,
      })
    ).toEqual({
      levelId: 'hourglass',
      difficulty: 'hard',
      won: true,
      durationSec: 42,
      boostsFired: 2,
      lost: 120,
      peakCount: 300,
      lowestSizeRatio: 0.4,
      captured: 250,
      enemyCrushed: 20,
      peakShare: 0.5,
      pellets: 7,
    });
  });

  it('counts a loss and a draw as not won', () => {
    const players = [human, computer];
    const result = (winner: typeof human | null) =>
      matchRecord(players, { ...match, durationSec: 5, winner })?.won;
    expect(result(computer)).toBe(false);
    expect(result(null)).toBe(false);
  });

  it('has nothing to record without a human', () => {
    expect(
      matchRecord([computer], { ...match, durationSec: 5, winner: computer })
    ).toBeNull();
  });
});

describe('betterMedal', () => {
  it('keeps the higher tier, whichever comes first', () => {
    expect(betterMedal('gold', 'silver')).toBe('gold');
    expect(betterMedal('bronze', 'platinum')).toBe('platinum');
    expect(betterMedal(null, 'bronze')).toBe('bronze');
    expect(betterMedal('silver', null)).toBe('silver');
    expect(betterMedal(null, null)).toBeNull();
  });
});

describe('medalGoal', () => {
  const limits = { silverSec: 90, goldSec: 65, goldLossShare: 0.45 };

  it('names what the next medallion asks for', () => {
    expect(medalGoal(limits, null)).toBe('Bronze needs a win.');
    expect(medalGoal(limits, 'bronze')).toBe('Silver needs a win within 1:30.');
    expect(medalGoal(limits, 'silver')).toBe(
      'Gold needs a win within 1:05, losing under 45 % of your peak colony.'
    );
    expect(medalGoal(limits, 'gold')).toContain('without a boost');
  });

  it('has nothing left to ask after platinum', () => {
    expect(medalGoal(limits, 'platinum')).toBeNull();
  });
});
