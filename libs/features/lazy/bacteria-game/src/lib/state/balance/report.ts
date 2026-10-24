import { ONLINE_SIM_RESOLUTION, SimResolution } from '../arena-size';
import { BOT_DIFFICULTIES, BotDifficulty } from '../bot-controller';
import { CHAPTERS } from '../chapters';
import { LADDER_VERSION, targetWinRate } from '../difficulty-curve';
import {
  GENES,
  Loadout,
  MAX_GENE_LEVEL,
  PLAIN_LOADOUT,
  WEAPONS,
} from '../evolution';
import { expectedDna, expectedLoadout } from '../expected-player';
import { BALANCE_VERSION } from '../game-balance';
import { getLevel, LEVELS, levelSize } from '../levels';
import { MedalTier } from '../medallions';
import { CHECK_SECONDS, LabCell, LabMatch, SHARE_SEC } from './lab-match';

/**
 * The balance lab's matrix, its report and the checks on it (ADR 0014).
 * The runner (`tools/bacteria-game/balance/`) plays the cells; this file
 * says which, sums them up and judges the sums - the same for the runner
 * and for the specs that hold the committed baseline to the checks.
 */

/** What the stand-in carries in a cell, by name. */
export type LoadoutName =
  | 'plain'
  | 'expected'
  | 'everything'
  | `gene:${string}`
  | `weapon:${string}`;

/** How a run is set up. */
export interface LabConfig {
  /**
   * Seeds per cell of the curve - the expected loadout - by difficulty:
   * the most on normal, which the target curve is set for.
   */
  curveSeeds: Readonly<Record<BotDifficulty, number>>;
  /**
   * The same on a map bigger than the screen, whose matches cost many
   * times as much - the nightly run's eight jobs can afford more.
   */
  bigMapSeeds: Readonly<Record<BotDifficulty, number>>;
  /** Seeds per cell of the gains - every other loadout, on normal. */
  gainSeeds: number;
  /** Seconds a match still on is cut off after. */
  horizonSec: number;
  /** Seeds per level of the short check. */
  checkSeeds: number;
  /** Seconds the short check plays. */
  checkHorizonSec: number;
  /**
   * The grid the matches of a base-size level are played on: the online
   * grid, which a recorded match plays on the CPU - what most players play
   * (ADR 0011) and what the medallion limits are measured on.
   */
  resolution: SimResolution;
  /**
   * The grid of a map bigger than the screen, which the game plays on the
   * GPU, unrecorded: the coarse one, which plays alike (the bots and the
   * levels think in base cells) at about 60 % of the cost - a big map's
   * match costs many times a base one's.
   */
  bigMapResolution: SimResolution;
}

/** The full run's setup - nightly, and for a new baseline. */
export const FULL_RUN: LabConfig = {
  curveSeeds: { easy: 3, normal: 6, hard: 3 },
  bigMapSeeds: { easy: 1, normal: 2, hard: 1 },
  gainSeeds: 2,
  // A stalemate is a stalemate after four minutes; the longest clock is 240 s.
  horizonSec: 245,
  checkSeeds: 2,
  checkHorizonSec: 90,
  resolution: ONLINE_SIM_RESOLUTION,
  bigMapResolution: 'low',
};

/** A cell of the matrix with its loadout's name. */
export interface NamedCell extends LabCell {
  loadout: LoadoutName;
}

/** The stand-in's loadout of that name on a ladder level. */
export function labLoadout(name: LoadoutName, levelId: string): Loadout {
  if (name === 'plain') {
    return PLAIN_LOADOUT;
  }
  if (name === 'expected') {
    const index = Math.max(
      0,
      LEVELS.findIndex(({ id }) => id === levelId)
    );
    return expectedLoadout(expectedDna(index));
  }
  if (name === 'everything') {
    return {
      genes: Object.fromEntries(GENES.map(({ id }) => [id, MAX_GENE_LEVEL])),
      weapon: 'phage-strike',
    };
  }
  const [kind, id] = name.split(':');
  return kind === 'gene'
    ? { genes: { [id]: MAX_GENE_LEVEL }, weapon: null }
    : ({ genes: {}, weapon: id } as Loadout);
}

/**
 * The levels the gains are measured on - one of each chapter but the
 * Expanse, whose big maps cost many times as much: a gain is the
 * evolution's, not the level's, and the matrix stays affordable.
 */
export const GAIN_LEVELS: readonly string[] = [
  'hourglass',
  'serpentine',
  'heartbeat',
  'containment',
  'quarantine',
];

/** The loadouts the gains are measured with: plain, each gene, each weapon, all. */
export const GAIN_LOADOUTS: readonly LoadoutName[] = [
  'plain',
  ...GENES.map(({ id }): LoadoutName => `gene:${id}`),
  ...WEAPONS.map(({ id }): LoadoutName => `weapon:${id}`),
  'everything',
];

/** The seed of the n-th match of a cell - the same for every loadout. */
export function labSeed(levelId: string, n: number): number {
  let hash = 2166136261;
  for (const char of `${levelId}#${n}`) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  }
  return hash;
}

/** The cells of a full run - on some levels only, when given. */
export function fullMatrix(
  config: LabConfig,
  levelIds: readonly string[] = LEVELS.map(({ id }) => id)
): NamedCell[] {
  const cells: NamedCell[] = [];
  for (const levelId of levelIds) {
    const seeds =
      levelSize(getLevel(levelId)) > 1 ? config.bigMapSeeds : config.curveSeeds;
    for (const { id: difficulty } of BOT_DIFFICULTIES) {
      for (let n = 0; n < seeds[difficulty]; n++) {
        cells.push(
          cellOf(config, levelId, difficulty, 'expected', n, config.horizonSec)
        );
      }
    }
    if (!GAIN_LEVELS.includes(levelId)) {
      continue;
    }
    // The share is taken over the first SHARE_SEC: no need to play on.
    for (const loadout of GAIN_LOADOUTS) {
      for (let n = 0; n < config.gainSeeds; n++) {
        cells.push(cellOf(config, levelId, 'normal', loadout, n, SHARE_SEC));
      }
    }
  }
  return cells;
}

/** The cells of the short check: the expected loadout on normal, briefly. */
export function checkMatrix(
  config: LabConfig,
  levelIds: readonly string[] = LEVELS.map(({ id }) => id)
): NamedCell[] {
  return levelIds.flatMap((levelId) =>
    Array.from({ length: config.checkSeeds }, (_, n) =>
      cellOf(config, levelId, 'normal', 'expected', n, config.checkHorizonSec)
    )
  );
}

function cellOf(
  config: LabConfig,
  levelId: string,
  difficulty: BotDifficulty,
  loadout: LoadoutName,
  n: number,
  horizonSec: number
): NamedCell {
  return {
    levelId,
    difficulty,
    loadout,
    standIn: labLoadout(loadout, levelId),
    seed: labSeed(levelId, n),
    horizonSec,
    resolution:
      levelSize(getLevel(levelId)) > 1
        ? config.bigMapResolution
        : config.resolution,
  };
}

/** The key a cell's matches are summed up under. */
export function cellKey(cell: {
  levelId: string;
  difficulty: BotDifficulty;
  loadout: LoadoutName;
}): string {
  return `${cell.levelId}/${cell.difficulty}/${cell.loadout}`;
}

/** What the matches of one cell came to. */
export interface CellStats {
  matches: number;
  /** The stand-in's wins as a share of the matches. */
  winRate: number;
  /**
   * The stand-in's score: wins, and half of the matches undecided at the
   * horizon - what the difficulty curve is measured by. A stalemate is not
   * a loss.
   */
  score: number;
  /** Matches neither won nor lost by the horizon. */
  undecided: number;
  /** The median seconds to a win and to a loss, null without any. */
  medianWinSec: number | null;
  medianLossSec: number | null;
  /** The fastest and the slowest win, null without any. */
  fastestWinSec: number | null;
  slowestWinSec: number | null;
  /** The median of the stand-in's lowest size against the computer's. */
  closeness: number;
  /** The median share of its colony at its peak the stand-in lost. */
  lostShare: number;
  /** The same over its wins only - what gold's loss limit is set from. */
  winLostShare: number | null;
  /** The share of matches that stalled at the cap. */
  stallRate: number;
  /** The stand-in's mean share of the players' bacteria. */
  share: number;
  /** The medallions the wins earned, by tier. */
  medals: Partial<Record<MedalTier, number>>;
  /** The computer's weapon shots per match, and their mean gain in points. */
  shotsPerMatch: number;
  shotGain: number | null;
}

/** The lab's report: what each cell came to, and the short check's shares. */
export interface BalanceReport {
  balanceVersion: number;
  /** The version of the ladder's computer it was played against. */
  ladderVersion: number;
  config: LabConfig;
  cells: Record<string, CellStats>;
  /** The short check: the stand-in's shares at 30, 60 and 90 s, per seed. */
  check: Record<string, number[][]>;
}

/** Sums up the matches played, by cell. */
export function summarize(
  config: LabConfig,
  played: readonly { cell: NamedCell; match: LabMatch }[],
  checked: readonly { cell: NamedCell; match: LabMatch }[]
): BalanceReport {
  const groups = new Map<string, LabMatch[]>();
  for (const { cell, match } of played) {
    const key = cellKey(cell);
    groups.set(key, [...(groups.get(key) ?? []), match]);
  }
  const cells: Record<string, CellStats> = {};
  for (const key of [...groups.keys()].sort()) {
    cells[key] = statsOf(groups.get(key) ?? []);
  }
  // By level, in the order of the seeds - whatever order they were played in.
  const check: Record<string, number[][]> = {};
  const seedIndex = ({ levelId, seed }: NamedCell) => {
    let n = 0;
    while (labSeed(levelId, n) !== seed && n < 1000) {
      n++;
    }
    return n;
  };
  for (const { cell, match } of [...checked].sort(
    (a, b) => seedIndex(a.cell) - seedIndex(b.cell)
  )) {
    (check[cell.levelId] ??= []).push([...match.shareAt]);
  }
  return {
    balanceVersion: BALANCE_VERSION,
    ladderVersion: LADDER_VERSION,
    config,
    cells,
    check,
  };
}

function statsOf(matches: readonly LabMatch[]): CellStats {
  const wins = matches.filter(({ won }) => won === true);
  const losses = matches.filter(({ won }) => won === false);
  const winTimes = wins.map(({ durationSec }) => durationSec);
  const shots = matches.flatMap((match) => match.shots);
  const medals: Partial<Record<MedalTier, number>> = {};
  for (const { medal } of wins) {
    if (medal !== null) {
      medals[medal] = (medals[medal] ?? 0) + 1;
    }
  }
  return {
    matches: matches.length,
    winRate: round(wins.length / matches.length),
    score: round(
      (wins.length + (matches.length - wins.length - losses.length) / 2) /
        matches.length
    ),
    undecided: matches.length - wins.length - losses.length,
    medianWinSec: median(winTimes),
    medianLossSec: median(losses.map(({ durationSec }) => durationSec)),
    fastestWinSec: winTimes.length === 0 ? null : Math.min(...winTimes),
    slowestWinSec: winTimes.length === 0 ? null : Math.max(...winTimes),
    closeness:
      median(matches.map(({ lowestSizeRatio }) => lowestSizeRatio)) ?? 0,
    lostShare: median(matches.map(({ lostShare }) => lostShare)) ?? 0,
    winLostShare: median(wins.map(({ lostShare }) => lostShare)),
    stallRate: round(
      matches.filter(({ stalled }) => stalled).length / matches.length
    ),
    share: round(mean(matches.map(({ share }) => share))),
    medals,
    shotsPerMatch: round(shots.length / matches.length),
    shotGain:
      shots.length === 0 ? null : round(mean(shots.map(({ gain }) => gain))),
  };
}

/**
 * Each gene's and weapon's gain on a level: the stand-in's share with it
 * less its share plain, on the same seeds, in points.
 */
export function gainsOf(
  report: BalanceReport,
  levelId: string
): Record<string, number> {
  const plain =
    report.cells[cellKey({ levelId, difficulty: 'normal', loadout: 'plain' })];
  const gains: Record<string, number> = {};
  if (plain === undefined) {
    return gains;
  }
  for (const loadout of GAIN_LOADOUTS.slice(1)) {
    const stats =
      report.cells[cellKey({ levelId, difficulty: 'normal', loadout })];
    if (stats !== undefined) {
      gains[loadout] = round((stats.share - plain.share) * 100);
    }
  }
  return gains;
}

/** The most a weapon may gain, on average over the levels, in points. */
export const MAX_WEAPON_GAIN = 15;
/** How far below 0 a weapon's average gain may sit before it counts as a loss. */
export const WEAPON_LOSS_TOLERANCE = 1;
/**
 * How far a level's score on normal may rise above the level's before
 * in the same chapter - the noise of {@link FULL_RUN}'s seeds.
 */
export const CURVE_TOLERANCE = 0.17;

/** A check the report fails, in a line. */
export type Finding = string;

/** The levels a report has cells of. */
function levelsOf(report: BalanceReport): string[] {
  return LEVELS.map(({ id }) => id).filter((levelId) =>
    BOT_DIFFICULTIES.some(
      ({ id: difficulty }) =>
        report.cells[cellKey({ levelId, difficulty, loadout: 'expected' })] !==
        undefined
    )
  );
}

/**
 * The checks of the ADR on a report: every level winnable with the
 * expected loadout, none stalling, silver and gold inside the win times
 * measured, no weapon gaining more than {@link MAX_WEAPON_GAIN} points or
 * losing any, and the curve rising within each chapter on normal.
 */
export function findings(report: BalanceReport): Finding[] {
  const found: Finding[] = [];
  const levels = levelsOf(report);
  for (const levelId of levels) {
    for (const { id: difficulty } of BOT_DIFFICULTIES) {
      const stats =
        report.cells[cellKey({ levelId, difficulty, loadout: 'expected' })];
      if (stats === undefined) {
        continue;
      }
      if (stats.winRate === 0) {
        found.push(
          `${levelId} on ${difficulty}: the stand-in never wins with the expected loadout`
        );
      }
      if (stats.stallRate > 0) {
        found.push(
          `${levelId} on ${difficulty}: ${percent(stats.stallRate)} of the matches stall at the cap`
        );
      }
    }
    found.push(...medalFindings(report, levelId));
  }
  found.push(...weaponFindings(report, levels));
  found.push(...curveFindings(report));
  return found;
}

/**
 * A better player wins up to this much faster than the stand-in's fastest
 * win - gold may ask for that much.
 */
export const GOLD_REACH = 2 / 3;
/** Silver allowing this many times the slowest win is given to everyone. */
export const SILVER_SLACK = 1.5;
/** The fewest wins on a level the medallion check judges by. */
const MEDAL_WINS = 3;

/**
 * Silver and gold inside the win times measured, over every difficulty:
 * gold within reach of a player a third faster than the stand-in's
 * fastest win, silver no laxer than half again its slowest - judged once
 * the stand-in won often enough to tell.
 */
function medalFindings(report: BalanceReport, levelId: string): Finding[] {
  const cells = BOT_DIFFICULTIES.map(
    ({ id: difficulty }) =>
      report.cells[cellKey({ levelId, difficulty, loadout: 'expected' })]
  ).filter(
    (stats): stats is CellStats =>
      stats !== undefined && stats.fastestWinSec !== null
  );
  const wins = cells.reduce(
    (sum, stats) => sum + Math.round(stats.winRate * stats.matches),
    0
  );
  if (wins < MEDAL_WINS) {
    return [];
  }
  const fastest = Math.min(
    ...cells.map((stats) => stats.fastestWinSec ?? Infinity)
  );
  const slowest = Math.max(...cells.map((stats) => stats.slowestWinSec ?? 0));
  const { medal } = getLevel(levelId);
  const found: Finding[] = [];
  if (medal.goldSec < fastest * GOLD_REACH) {
    found.push(
      `${levelId}: gold asks for ${medal.goldSec} s, the fastest win took ${fastest} s`
    );
  }
  if (medal.silverSec > slowest * SILVER_SLACK) {
    found.push(
      `${levelId}: silver allows ${medal.silverSec} s, the slowest win took ${slowest} s`
    );
  }
  return found;
}

function weaponFindings(
  report: BalanceReport,
  levels: readonly string[]
): Finding[] {
  const found: Finding[] = [];
  for (const { id } of WEAPONS) {
    const gains = levels
      .map((levelId) => gainsOf(report, levelId)[`weapon:${id}`])
      .filter((gain): gain is number => gain !== undefined);
    if (gains.length === 0) {
      continue;
    }
    const average = mean(gains);
    if (average > MAX_WEAPON_GAIN) {
      found.push(
        `${id}: gains ${average.toFixed(1)} points of share on average`
      );
    }
    if (average < -WEAPON_LOSS_TOLERANCE) {
      found.push(
        `${id}: loses ${(-average).toFixed(1)} points of share on average`
      );
    }
  }
  return found;
}

function curveFindings(report: BalanceReport): Finding[] {
  const found: Finding[] = [];
  for (const chapter of CHAPTERS) {
    let before: { levelId: string; score: number } | null = null;
    for (const levelId of chapter.levelIds) {
      const stats =
        report.cells[
          cellKey({ levelId, difficulty: 'normal', loadout: 'expected' })
        ];
      if (stats === undefined) {
        continue;
      }
      if (before !== null && stats.score > before.score + CURVE_TOLERANCE) {
        found.push(
          `${chapter.id}: ${levelId} (${percent(stats.score)}) is easier than ${before.levelId} (${percent(before.score)}) before it`
        );
      }
      before = { levelId, score: stats.score };
    }
  }
  return found;
}

/** How far a cell may move from the baseline before it counts as drift. */
export const DRIFT = {
  /** Win rate, of a cell of the curve. */
  winRate: 0.26,
  /** Mean share of the players' bacteria. */
  share: 0.1,
  /** A share of the short check, at one of its seconds. */
  checkShare: 0.12,
} as const;

/** The cells of a run that moved from the baseline, in a line each. */
export function drift(baseline: BalanceReport, run: BalanceReport): Finding[] {
  const found: Finding[] = [];
  if (baseline.balanceVersion !== run.balanceVersion) {
    found.push(
      `BALANCE_VERSION moved from ${baseline.balanceVersion} to ${run.balanceVersion}: re-baseline`
    );
  }
  if (baseline.ladderVersion !== run.ladderVersion) {
    found.push(
      `LADDER_VERSION moved from ${baseline.ladderVersion} to ${run.ladderVersion}: re-baseline`
    );
  }
  for (const [key, stats] of Object.entries(run.cells)) {
    const before = baseline.cells[key];
    if (before === undefined) {
      found.push(`${key}: not in the baseline`);
      continue;
    }
    if (Math.abs(stats.winRate - before.winRate) > DRIFT.winRate) {
      found.push(
        `${key}: win rate ${percent(before.winRate)} → ${percent(stats.winRate)}`
      );
    }
    if (Math.abs(stats.share - before.share) > DRIFT.share) {
      found.push(
        `${key}: share ${percent(before.share)} → ${percent(stats.share)}`
      );
    }
  }
  found.push(...checkDrift(baseline, run));
  return found;
}

/** The short check's shares that moved from the baseline's. */
export function checkDrift(
  baseline: BalanceReport,
  run: BalanceReport
): Finding[] {
  const found: Finding[] = [];
  for (const [levelId, seeds] of Object.entries(run.check)) {
    const before = baseline.check[levelId];
    if (before === undefined) {
      found.push(`${levelId}: no short check in the baseline`);
      continue;
    }
    seeds.forEach((shares, n) => {
      shares.forEach((share, i) => {
        const was = before[n]?.[i];
        if (was === undefined || Math.abs(share - was) > DRIFT.checkShare) {
          found.push(
            `${levelId}, seed ${n + 1}, ${CHECK_SECONDS[i]} s: share ${was === undefined ? '-' : percent(was)} → ${percent(share)}`
          );
        }
      });
    });
  }
  return found;
}

/**
 * Medallion limits as the measurements put them, next to the level's: on
 * normal with the expected loadout, silver at the median win, gold at two
 * thirds of it and gold's losses at the median share the wins lost.
 */
export function medalTable(report: BalanceReport): string[] {
  const lines = [
    '| Level | Wins | Median win | Silver | Gold | Gold losses |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const { id: levelId, medal } of LEVELS) {
    const stats =
      report.cells[
        cellKey({ levelId, difficulty: 'normal', loadout: 'expected' })
      ];
    const proposal = stats === undefined ? null : measuredMedals(stats);
    const pair = (now: number, measured: number | undefined) =>
      measured === undefined ? `${now}` : `${now} → ${measured}`;
    lines.push(
      `| ${levelId} | ${stats === undefined ? '-' : `${Math.round(stats.winRate * stats.matches)}/${stats.matches}`} | ${stats?.medianWinSec ?? '-'} | ${pair(medal.silverSec, proposal?.silverSec)} | ${pair(medal.goldSec, proposal?.goldSec)} | ${pair(medal.goldLossShare, proposal?.goldLossShare)} |`
    );
  }
  return lines;
}

/** The medallion limits a cell's wins put - null without wins. */
export function measuredMedals(
  stats: CellStats
): { silverSec: number; goldSec: number; goldLossShare: number } | null {
  if (stats.medianWinSec === null) {
    return null;
  }
  return {
    silverSec: Math.round(stats.medianWinSec / 5) * 5,
    goldSec: Math.round((stats.medianWinSec * 2) / 3 / 5) * 5,
    goldLossShare: Math.round((stats.winLostShare ?? 0) * 10) / 10,
  };
}

/** The measured score of each level and difficulty next to its target. */
export function curveTable(report: BalanceReport): string[] {
  const lines = [
    '| Level | Easy | Normal | Hard |',
    '| --- | --- | --- | --- |',
  ];
  for (const { id: levelId } of LEVELS) {
    const cells = BOT_DIFFICULTIES.map(({ id: difficulty }) => {
      const stats =
        report.cells[cellKey({ levelId, difficulty, loadout: 'expected' })];
      return stats === undefined
        ? '-'
        : `${percent(stats.score)} (${percent(targetWinRate(levelId, difficulty))})`;
    });
    lines.push(`| ${levelId} | ${cells.join(' | ')} |`);
  }
  return lines;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return round(
    sorted.length % 2 === 1
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2
  );
}

function mean(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percent(share: number): string {
  return `${Math.round(share * 100)} %`;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
