import { arenaSize, SimResolution } from '../arena-size';
import {
  BotDifficulty,
  BotProfile,
  REFERENCE_PROFILE,
} from '../bot-controller';
import { computerLoadout } from '../computer-opponent';
import {
  computerProfile,
  LADDER_VERSION,
  profileAt,
} from '../difficulty-curve';
import { Loadout } from '../evolution';
import { TICKS_PER_SEC } from '../fixed-tick';
import { getLevel, levelSize } from '../levels';
import { MatchEngine } from '../match-engine';
import { planMatch } from '../match-setup';
import { medalFor, MedalTier } from '../medallions';
import { clockOf, winRuleOf } from '../win-conditions';

/**
 * One match of the balance lab (ADR 0016): the stand-in for a human - a
 * bot with {@link REFERENCE_PROFILE} in the left seat - against the
 * computer as the ladder sets it up, on the CPU engine, with what it
 * measured. Deterministic: the same cell plays the same match anywhere.
 */

/** What a lab match is played from. */
export interface LabCell {
  levelId: string;
  difficulty: BotDifficulty;
  /** What the stand-in carries. */
  standIn: Loadout;
  /** What the computer carries - its ladder loadout when absent. */
  computer?: Loadout;
  /**
   * Where the computer plays in its band, 0..1 - the curve's value for the
   * level when absent. For calibrating the curve.
   */
  skill?: number;
  /** Changes to the computer's profile - for trying a rule out. */
  tweaks?: Partial<BotProfile>;
  seed: number;
  /**
   * Seconds of match time after which a match still on is cut off - a
   * level's own clock ends it sooner.
   */
  horizonSec: number;
  /**
   * The grid it is played on - normal when absent. The coarser grid plays
   * alike at about 60 % of the cost.
   */
  resolution?: SimResolution;
}

/** A shot of the computer's weapon and what it changed. */
export interface LabShot {
  /** Seconds into the match it was fired. */
  atSec: number;
  /**
   * Points of the share of all bacteria the computer's colony gained over
   * the {@link SHOT_WINDOW_SEC} after the shot.
   */
  gain: number;
}

/** What a lab match measured. */
export interface LabMatch {
  /**
   * True when the stand-in won, false when it lost, null when undecided:
   * cut off at the horizon, or stalled on a level won by annihilation.
   */
  won: boolean | null;
  /**
   * Seconds of match time it took - the horizon when undecided, or the
   * second a match won by annihilation alone stalled.
   */
  durationSec: number;
  /** The medallion the stand-in's win earned, null for none. */
  medal: MedalTier | null;
  /** The stand-in's lowest size against the computer's. */
  lowestSizeRatio: number;
  /** The stand-in's bacteria lost as a share of its colony at its peak. */
  lostShare: number;
  /** True when both colonies sat at their cap for {@link STALL_SEC}. */
  stalled: boolean;
  /**
   * The stand-in's share of the players' bacteria, averaged over every
   * second up to {@link SHARE_SEC} - a match decided sooner counts its
   * last share for the rest. 0..1.
   */
  share: number;
  /** The stand-in's share after 30, 60 and 90 seconds - the short check's. */
  shareAt: readonly number[];
  /** The computer's weapon shots. */
  shots: readonly LabShot[];
}

/** Within this share of their cap a colony counts as at the cap. */
export const CAP_SHARE = 0.98;
/** Seconds both colonies sit at their cap before a match counts as stalled. */
export const STALL_SEC = 30;
/** The seconds the share is averaged over. */
export const SHARE_SEC = 120;
/** Seconds after a shot its effect is measured over. */
export const SHOT_WINDOW_SEC = 5;
/** The seconds the short check takes the share at. */
export const CHECK_SECONDS: readonly number[] = [30, 60, 90];

/** The colours of the two seats - they change nothing. */
const COLORS: [string, string] = ['orange', 'blue'];

/** Plays a lab cell to its end or its horizon. */
export function playLabMatch(cell: LabCell): LabMatch {
  const level = getLevel(cell.levelId);
  const { width, height } = arenaSize(
    cell.resolution ?? 'normal',
    levelSize(level)
  );
  const plan = {
    levelId: cell.levelId,
    mode: 'vs-computer' as const,
    difficulty: cell.difficulty,
    colors: COLORS,
    headStart: 0 as const,
    width,
    height,
    seed: cell.seed,
    loadouts: [
      cell.standIn,
      cell.computer ?? computerLoadout(cell.levelId, cell.difficulty),
    ] as const,
    ladder: LADDER_VERSION,
  };
  const { spawns, options } = planMatch(plan);
  const engine = new MatchEngine(
    spawns.map((spawn, seat) =>
      seat === 0 ? { ...spawn, isBot: true } : spawn
    ),
    {
      ...options,
      botProfile: {
        ...(cell.skill === undefined
          ? computerProfile(cell.levelId, cell.difficulty)
          : profileAt(cell.difficulty, cell.skill, level.boss !== undefined)),
        ...cell.tweaks,
      },
      standIns: new Map([[0, REFERENCE_PROFILE]]),
    }
  );
  try {
    return measure(engine, cell, width, height);
  } finally {
    engine.dispose();
  }
}

function measure(
  engine: MatchEngine,
  cell: LabCell,
  width: number,
  height: number
): LabMatch {
  const level = getLevel(cell.levelId);
  const rule = winRuleOf(level);
  const limit = Math.min(cell.horizonSec, (clockOf(rule) ?? Infinity) + 1);
  const { capacity } = engine;
  const shares: number[] = [];
  const shareAt: number[] = [];
  const shots: LabShot[] = [];
  const pending: { atSec: number; before: number }[] = [];
  const watch = stallWatch(capacity);
  let stalled = false;
  let shotsSeen = 0;
  const maxTicks = Math.round(limit * TICKS_PER_SEC);
  for (let tick = 0; tick < maxTicks && engine.outcome() == null; tick++) {
    engine.tick(width, height);
    const [standIn, computer] = engine.players;
    const all =
      standIn.bacteriaCount +
      computer.bacteriaCount +
      (engine.neutralCount ?? 0);
    const computerShare = all > 0 ? computer.bacteriaCount / all : 0;
    for (; shotsSeen < computer.weaponsFired; shotsSeen++) {
      pending.push({
        atSec: engine.tickCount / TICKS_PER_SEC,
        before: computerShare,
      });
    }
    if (engine.tickCount % TICKS_PER_SEC !== 0) {
      continue;
    }
    const second = engine.tickCount / TICKS_PER_SEC;
    const players = standIn.bacteriaCount + computer.bacteriaCount;
    const share = players > 0 ? standIn.bacteriaCount / players : 0.5;
    if (second <= SHARE_SEC) {
      shares.push(share);
    }
    if (CHECK_SECONDS.includes(second)) {
      shareAt.push(round(share));
    }
    while (pending.length > 0 && second - pending[0].atSec >= SHOT_WINDOW_SEC) {
      const shot = pending.shift();
      if (shot !== undefined) {
        shots.push({
          atSec: round(shot.atSec),
          gain: round((computerShare - shot.before) * 100),
        });
      }
    }
    stalled = watch(standIn.bacteriaCount, computer.bacteriaCount);
    // Won by annihilation alone, a stalled match is a stalemate: no need to
    // play it to the horizon. A clock, a zone or the pellets still decide.
    if (stalled && rule.kind === 'annihilation') {
      break;
    }
  }
  const outcome = engine.outcome();
  const [standIn] = engine.players;
  const durationSec = engine.tickCount / TICKS_PER_SEC;
  const won = outcome === null ? null : outcome.winner?.id === 0;
  // A decided match counts all or nothing for the seconds after its end, a
  // cut off one its last share.
  const rest = won === null ? (shares.at(-1) ?? 0.5) : won ? 1 : 0;
  while (shares.length < SHARE_SEC) {
    shares.push(rest);
  }
  while (shareAt.length < CHECK_SECONDS.length) {
    shareAt.push(round(rest));
  }
  const lostShare =
    standIn.peakCount > 0 ? standIn.lost / standIn.peakCount : 0;
  return {
    won,
    durationSec: round(durationSec),
    medal:
      won === true
        ? medalFor(level.medal, {
            levelId: cell.levelId,
            difficulty: cell.difficulty,
            won: true,
            durationSec,
            boostsFired: standIn.boostsFired,
            lost: standIn.lost,
            peakCount: standIn.peakCount,
            lowestSizeRatio: standIn.lowestSizeRatio,
            captured: standIn.captured,
            enemyCrushed: 0,
            peakShare: capacity > 0 ? standIn.peakCount / capacity : 0,
            pellets: standIn.pellets,
          })
        : null,
    lowestSizeRatio: round(
      Number.isFinite(standIn.lowestSizeRatio) ? standIn.lowestSizeRatio : 1
    ),
    lostShare: round(lostShare),
    stalled,
    share: round(shares.reduce((sum, value) => sum + value, 0) / shares.length),
    shareAt,
    shots,
  };
}

/**
 * Watches a match for a stall, a second at a time: true from the second
 * both colonies have sat within {@link CAP_SHARE} of their cap for
 * {@link STALL_SEC} seconds in a row on.
 */
export function stallWatch(
  capacity: number
): (standIn: number, computer: number) => boolean {
  let atCap = 0;
  let stalled = false;
  return (standIn, computer) => {
    const capped =
      standIn >= capacity * CAP_SHARE && computer >= capacity * CAP_SHARE;
    atCap = capped ? atCap + 1 : 0;
    stalled ||= atCap >= STALL_SEC;
    return stalled;
  };
}

/** A value rounded to three places, as the report keeps it. */
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
