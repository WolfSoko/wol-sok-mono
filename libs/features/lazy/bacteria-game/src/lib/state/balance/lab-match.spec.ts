import { computerLoadout } from '../computer-opponent';
import { GENES, MAX_GENE_LEVEL } from '../evolution';
import {
  CHECK_SECONDS,
  LabCell,
  LabMatch,
  playLabMatch,
  STALL_SEC,
  stallWatch,
} from './lab-match';

/** A lab match cut off early - the lab's own run plays minutes. */
const CELL: LabCell = {
  levelId: 'hourglass',
  difficulty: 'normal',
  standIn: { genes: { mitosis: 1 }, weapon: 'toxin-bomb' },
  seed: 42,
  horizonSec: 8,
  resolution: 'low',
};

/** A level whose ladder computer carries a weapon: the meltdown's toxin bomb. */
const ARMED_LEVEL = 'meltdown';

describe('a lab match', () => {
  let match: LabMatch;

  beforeAll(() => {
    match = playLabMatch(CELL);
  });

  it('plays the same match from the same cell', () => {
    expect(playLabMatch(CELL)).toEqual(match);
  });

  it('is cut off at its horizon, undecided, with every share it needs', () => {
    expect(match.won).toBeNull();
    expect(match.durationSec).toBe(8);
    expect(match.medal).toBeNull();
    expect(match.stalled).toBe(false);
    expect(match.shareAt).toHaveLength(CHECK_SECONDS.length);
    expect(match.share).toBeGreaterThan(0);
    expect(match.share).toBeLessThan(1);
  });

  it('lets the stand-in fire its weapon from the start, as a human could', () => {
    expect(computerLoadout(ARMED_LEVEL, 'normal').weapon).not.toBeNull();
    // A weapon the computer carries starts charging: within the first
    // seconds only the stand-in can have fired - and the computer nothing.
    const armed = playLabMatch({ ...CELL, levelId: ARMED_LEVEL });

    expect(armed.shots).toEqual([]);
  });

  it("measures the computer's shots and what they changed", () => {
    // A stand-in with every gene maxed lasts until the toxin bomb has
    // charged, about 22 s in.
    const armed = playLabMatch({
      ...CELL,
      levelId: ARMED_LEVEL,
      standIn: {
        genes: Object.fromEntries(GENES.map(({ id }) => [id, MAX_GENE_LEVEL])),
        weapon: null,
      },
      tweaks: { weaponPatience: 0.01 },
      horizonSec: 23,
    });

    expect(armed.shots.length).toBeGreaterThan(0);
    for (const shot of armed.shots) {
      expect(shot.atSec).toBeGreaterThan(20);
      expect(Number.isFinite(shot.gain)).toBe(true);
    }
  });
});

describe('the stall watch', () => {
  it('calls a match stalled once both colonies sat at their cap long enough', () => {
    const watch = stallWatch(1000);
    const seconds = Array.from({ length: STALL_SEC }, () => watch(990, 985));

    expect(seconds.slice(0, -1).every((stalled) => !stalled)).toBe(true);
    expect(seconds.at(-1)).toBe(true);
    // Once stalled, the match stays so.
    expect(watch(10, 10)).toBe(true);
  });

  it('starts counting again when a colony drops below its cap', () => {
    const watch = stallWatch(1000);
    for (let second = 1; second < STALL_SEC; second++) {
      watch(1000, 1000);
    }
    watch(900, 1000);

    expect(watch(1000, 1000)).toBe(false);
  });
});
