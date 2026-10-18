import { MatchTally } from './match-tally';
import { createPlayer, Player } from './player.model';

function players(human: number, bot: number, lost = 0): Player[] {
  return [
    createPlayer({ id: 0, isBot: false, bacteriaCount: human, lost }),
    createPlayer({ id: 1, isBot: true, bacteriaCount: bot }),
  ];
}

const MATCH = { levelId: 'hourglass', difficulty: 'hard' as const };

describe('MatchTally', () => {
  it('records the peak, the lowest size ratio and the human boosts', () => {
    const tally = new MatchTally();
    tally.frame(players(100, 100), []);
    tally.frame(players(300, 150), [false, true]);
    tally.frame(players(80, 200), [true]);
    tally.frame(players(200, 50), [false]);
    const end = players(250, 0, 120);

    expect(
      tally.record(end, { ...MATCH, winner: end[0], durationSec: 42 })
    ).toEqual({
      levelId: 'hourglass',
      difficulty: 'hard',
      won: true,
      durationSec: 42,
      boostsFired: 2,
      lost: 120,
      peakCount: 300,
      lowestSizeRatio: 0.4,
    });
  });

  it('does not count the last frame of a lost colony as a size ratio', () => {
    const tally = new MatchTally();
    tally.frame(players(100, 100), []);
    tally.frame(players(0, 100), []);
    const end = players(0, 100, 100);

    const record = tally.record(end, {
      ...MATCH,
      winner: end[1],
      durationSec: 10,
    });
    expect(record.won).toBe(false);
    expect(record.lowestSizeRatio).toBe(1);
  });

  it('counts a draw as not won', () => {
    const tally = new MatchTally();
    const end = players(0, 0);
    expect(
      tally.record(end, { ...MATCH, winner: null, durationSec: 5 }).won
    ).toBe(false);
  });
});
