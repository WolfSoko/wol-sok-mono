import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BOT_DIFFICULTIES } from '../bot-controller';
import { LADDER_VERSION, targetWinRate } from '../difficulty-curve';
import { BALANCE_VERSION } from '../game-balance';
import { isBigMap, LEVELS } from '../levels';
import { playLabMatch } from './lab-match';
import {
  BalanceReport,
  checkMatrix,
  expectedStats,
  findings,
  FULL_RUN,
  GAIN_LEVELS,
  gainsOf,
} from './report';

/**
 * The balance lab's committed baseline (ADR 0016) held to the ADR's checks.
 * The lab itself plays minutes per match, so it runs as its own Nx targets
 * (`feat-lazy-bacteria-game:balance-check`, `:balance`) and nightly; here
 * the baseline is checked, and a few seconds of a lab match pin what the
 * lab plays.
 */
const REPORT = JSON.parse(
  readFileSync(join(__dirname, 'balance-report.json'), 'utf8')
) as BalanceReport;

/**
 * What the baseline fails of the ADR's checks, besides stalls at the cap -
 * each one known, so a new baseline that fails another one fails here. Most
 * cells the stand-in "never wins" are stalemates: two colonies at their cap
 * that neither side breaks (see the ADR), counted as half in the score.
 */
const KNOWN_FINDINGS: readonly string[] = [
  'petri-dish on easy: the stand-in never wins with the expected loadout',
  'corridors on hard: the stand-in never wins with the expected loadout',
  'hourglass on easy: the stand-in never wins with the expected loadout',
  'hourglass on hard: the stand-in never wins with the expected loadout',
  'inner-ring on easy: the stand-in never wins with the expected loadout',
  'inner-ring on normal: the stand-in never wins with the expected loadout',
  'inner-ring on hard: the stand-in never wins with the expected loadout',
  'twin-chambers on easy: the stand-in never wins with the expected loadout',
  'twin-chambers on normal: the stand-in never wins with the expected loadout',
  'twin-chambers on hard: the stand-in never wins with the expected loadout',
  'serpentine on hard: the stand-in never wins with the expected loadout',
  'containment on hard: the stand-in never wins with the expected loadout',
  'control-room on normal: the stand-in never wins with the expected loadout',
  'control-room: silver allows 75 s, the slowest win took 43.683 s',
  'meltdown on hard: the stand-in never wins with the expected loadout',
  'meltdown: gold asks for 35 s, the fastest win took 57.4 s',
  'patient-zero on easy: the stand-in never wins with the expected loadout',
  'patient-zero on hard: the stand-in never wins with the expected loadout',
  'expanse on normal: the stand-in never wins with the expected loadout',
  'expanse on hard: the stand-in never wins with the expected loadout',
  'archipelago on normal: the stand-in never wins with the expected loadout',
  'bloodstream on hard: the stand-in never wins with the expected loadout',
  'root-network on hard: the stand-in never wins with the expected loadout',
  'leviathan on easy: the stand-in never wins with the expected loadout',
  'leviathan on normal: the stand-in never wins with the expected loadout',
  // 14.0 points in the last baseline: at the limit on either, by the seeds.
  'toxin-bomb: gains 15.1 points of share on average',
  'cryo-pulse: loses 2.7 points of share on average',
  'laboratory: pillar-field (75 %) is easier than inner-ring (50 %) before it',
  'laboratory: pistons (92 %) is easier than serpentine (67 %) before it',
  'body: mycelium (92 %) is easier than alveoli (67 %) before it',
  'reactor: meltdown (33 %) is easier than control-room (0 %) before it',
  'outbreak: quarantine (100 %) is easier than patient-zero (67 %) before it',
  'expanse: bloodstream (50 %) is easier than archipelago (0 %) before it',
];

/**
 * Cells of the curve within 15 points of their target in the baseline. The
 * seeds are few (most on normal, one or two on a big map) and stalemates
 * pin the early levels near half: a new baseline may not hold fewer.
 */
const CURVE_HELD = 25;

describe('the balance baseline', () => {
  it('was played under the balance and the ladder of today', () => {
    expect(REPORT.balanceVersion).toBe(BALANCE_VERSION);
    expect(REPORT.ladderVersion).toBe(LADDER_VERSION);
    expect(REPORT.config).toEqual(FULL_RUN);
  });

  it('covers every level and difficulty of the ladder', () => {
    for (const { id: levelId } of LEVELS) {
      for (const { id: difficulty } of BOT_DIFFICULTIES) {
        expect(expectedStats(REPORT, levelId, difficulty)?.matches).toBe(
          (isBigMap(levelId) ? FULL_RUN.bigMapSeeds : FULL_RUN.curveSeeds)[
            difficulty
          ]
        );
      }
      expect(REPORT.check[levelId]).toHaveLength(FULL_RUN.checkSeeds);
    }
    for (const levelId of GAIN_LEVELS) {
      expect(Object.keys(gainsOf(REPORT, levelId))).toHaveLength(11);
    }
  });

  it('fails no check of the ADR it is not known to fail', () => {
    const found = findings(REPORT).filter(
      (finding) => !finding.endsWith('stall at the cap')
    );

    expect(
      found.filter((finding) => !KNOWN_FINDINGS.includes(finding))
    ).toEqual([]);
  });

  it('holds the target curve as far as it did', () => {
    const held = LEVELS.flatMap(({ id: levelId }) =>
      BOT_DIFFICULTIES.map(({ id: difficulty }) => {
        const stats = expectedStats(REPORT, levelId, difficulty);
        return (
          stats !== undefined &&
          Math.abs(stats.score - targetWinRate(levelId, difficulty)) <= 0.15
        );
      })
    ).filter(Boolean).length;

    expect(held).toBeGreaterThanOrEqual(CURVE_HELD);
  });

  it('is what the lab plays today', () => {
    // Six seconds of the short check's first match, on the coarse grid: the
    // stand-in (its profile and loadout) against the ladder's computer (its
    // weapon and genes). A change that moves it moves the lab - take the new
    // numbers with a new baseline.
    const [cell] = checkMatrix(FULL_RUN, ['quarantine']);
    const match = playLabMatch({ ...cell, horizonSec: 6, resolution: 'low' });

    expect(match).toEqual({
      won: null,
      durationSec: 6,
      medal: null,
      lowestSizeRatio: 0.971,
      lostShare: 0.065,
      stalled: false,
      share: 0.855,
      shareAt: [0.865, 0.865, 0.865],
      shots: [],
    });
  });
});
