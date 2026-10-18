import {
  betterMedal,
  MatchRecord,
  MedalLimits,
  medalFor,
  medalHint,
} from './medallions';

const LIMITS: MedalLimits = { silverSec: 60, goldSec: 40, goldLossShare: 0.3 };

/** A flawless win, which the tests take apart one condition at a time. */
const PLATINUM_RUN: MatchRecord = {
  levelId: 'petri-dish',
  difficulty: 'normal',
  won: true,
  durationSec: 30,
  boostsFired: 0,
  lost: 10,
  peakCount: 1000,
  lowestSizeRatio: 0.9,
};

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

  it('never skips a tier: a slow flawless win is bronze', () => {
    expect(medalFor(LIMITS, run({ durationSec: 90 }))).toBe('bronze');
  });
});

describe('medalHint', () => {
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

  it('has nothing left to ask after platinum', () => {
    expect(medalHint(LIMITS, PLATINUM_RUN)).toBeNull();
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
