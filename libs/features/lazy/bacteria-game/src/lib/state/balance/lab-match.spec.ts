import { PLAIN_LOADOUT } from '../evolution';
import {
  CHECK_SECONDS,
  LabCell,
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
};

describe('a lab match', () => {
  it('plays the same match from the same cell', () => {
    expect(playLabMatch(CELL)).toEqual(playLabMatch(CELL));
  });

  it('is cut off at its horizon, undecided, with every share it needs', () => {
    const match = playLabMatch(CELL);

    expect(match.won).toBeNull();
    expect(match.durationSec).toBe(8);
    expect(match.medal).toBeNull();
    expect(match.stalled).toBe(false);
    expect(match.shareAt).toHaveLength(CHECK_SECONDS.length);
    expect(match.share).toBeGreaterThan(0);
    expect(match.share).toBeLessThan(1);
  });

  it('lets the stand-in fire its weapon from the start, as a human could', () => {
    // A weapon the computer carries starts charging: within the first
    // seconds only the stand-in can have fired - and the computer nothing.
    const match = playLabMatch({
      ...CELL,
      computer: { genes: {}, weapon: 'toxin-bomb' },
    });

    expect(match.shots).toEqual([]);
  });

  it("measures the computer's shots and what they changed", () => {
    const match = playLabMatch({
      ...CELL,
      levelId: 'pillar-field',
      standIn: PLAIN_LOADOUT,
      computer: { genes: {}, weapon: 'phage-strike' },
      tweaks: { weaponPatience: 0.01 },
      horizonSec: 40,
    });

    expect(match.shots.length).toBeGreaterThan(0);
    for (const shot of match.shots) {
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
