import {
  afterMatch,
  ENDLESS_LIVES,
  endlessLevelId,
  isRunOver,
  newRun,
} from './endless';
import { parseGeneratedId } from './level-generator/generate-level';

describe('an endless run', () => {
  it('starts at the calmest level with all its lives', () => {
    const run = newRun(42);

    expect(run).toEqual({ seed: 42, wins: 0, lives: ENDLESS_LIVES });
    expect(parseGeneratedId(endlessLevelId(run))?.difficulty).toBe(1);
  });

  it('climbs a step with every win, to a level of a new style', () => {
    const first = newRun(42);
    const second = afterMatch(first, true);

    expect(second.wins).toBe(1);
    expect(endlessLevelId(second)).not.toBe(endlessLevelId(first));
    expect(parseGeneratedId(endlessLevelId(second))?.difficulty).toBe(2);
    expect(parseGeneratedId(endlessLevelId(second))?.recipe).not.toBe(
      parseGeneratedId(endlessLevelId(first))?.recipe
    );
  });

  it('tops out at the hardest difficulty', () => {
    const deep = { ...newRun(1), wins: 25 };

    expect(parseGeneratedId(endlessLevelId(deep))?.difficulty).toBe(10);
  });

  it('loses a life on a defeat and tries the same level again', () => {
    const run = newRun(42);
    const after = afterMatch(run, false);

    expect(after.lives).toBe(ENDLESS_LIVES - 1);
    expect(endlessLevelId(after)).toBe(endlessLevelId(run));
  });

  it('is over with its last life', () => {
    let run = newRun(7);
    for (let defeat = 0; defeat < ENDLESS_LIVES; defeat++) {
      expect(isRunOver(run)).toBe(false);
      run = afterMatch(run, false);
    }

    expect(isRunOver(run)).toBe(true);
  });

  it('plays the same levels for the same seed', () => {
    expect(endlessLevelId(afterMatch(newRun(9), true))).toBe(
      endlessLevelId(afterMatch(newRun(9), true))
    );
  });
});
