import {
  missionById,
  missionOf,
  type MissionId,
  type RankedMatch,
  type RankedOutcome,
  type Replay,
  type SeriesLength,
} from '@wolsok/feat-shared-bacteria-engine';
import type { GameMode, OnlineSeat } from './game.states';

/**
 * What the next match is set to outside the setup. It holds for that one
 * match: a reset sets it back to `setup`.
 */
export type OneMatch =
  /** The match the setup describes: its level and mode. */
  | { kind: 'setup' }
  /** Against a recorded run - the player's own or one shared - on its level. */
  | { kind: 'ghost'; run: Replay }
  /** A training mission, on its level. */
  | { kind: 'mission'; mission: MissionId }
  /**
   * The daily level of that UTC day. `ranked` is what its ranked start
   * came to (ADR 0012), null for one played as practice.
   */
  | {
      kind: 'daily';
      day: string;
      levelId: string;
      ranked: RankedOutcome | null;
    }
  /** The endless run's match, on the level the run is at. */
  | { kind: 'endless'; levelId: string; ranked: RankedOutcome | null };

/**
 * What the next match is: the one-match setting, or online the match the
 * connection plays - an online seat outlasts any one-match setting.
 */
export type NextMatch = OneMatch | { kind: 'online'; seat: OnlineSeat };

/** The one-match setting of no match outside the setup. */
export const SETUP_MATCH: OneMatch = { kind: 'setup' };

/** The parts of the setup the rules of a match depend on. */
export interface RulesSetup {
  levelId: string;
  mode: GameMode;
  seriesLength: SeriesLength;
}

/** How a match is played, as the HUD, the stats and the result tell it. */
export type MatchKind =
  | 'two-players'
  | 'vs-computer'
  | 'ghost'
  | 'training'
  | 'daily'
  | 'endless'
  | 'online';

/**
 * Whether the match is recorded (ADR 0011): online always, a ranked one
 * always (and uploaded with its attempt), `local` while the player records
 * local matches - and not at all.
 */
export type RecordingRule = 'online' | 'ranked' | 'local' | 'none';

/** Everything that follows from what the next match is. */
export interface MatchRules {
  kind: MatchKind;
  /** The level the match is played on. */
  levelId: string;
  /** The mode it is planned in - a level picked for it is vs the computer. */
  planMode: GameMode;
  /** The training mission it is played for, null outside the training. */
  mission: MissionId | null;
  recording: RecordingRule;
  /**
   * True when the evolution plays a part (ADR 0016): against the computer
   * or a ghost on the ladder or a generated level. The daily level and
   * endless runs feed the leaderboards and stay plain, as do couch and
   * online matches and the training, which teaches the colony every player
   * starts with.
   */
  evolves: boolean;
  /**
   * True when the match counts for the progress: a medallion, XP, the
   * couch rivalry. A ghost or online match is played for fun.
   */
  earns: boolean;
  /** True when the match belongs to a series between two players. */
  inSeries: boolean;
  /** The ranked attempt the match was declared as, null for an unranked one. */
  rankedMatch: RankedMatch | null;
  /**
   * What the ranked start of a daily or endless match came to (ADR 0012):
   * the attempt - null when it plays unranked - and what the result screen
   * says of it. Null for any other match, and for one played as practice.
   */
  ranked: RankedOutcome | null;
  /** False for a ranked match: its attempt has a deadline (ADR 0012). */
  canPause: boolean;
  /**
   * True where Restart may start the match again: never in an endless
   * run (it would cost no life) or a ranked match (its seed plays once),
   * online only on the host.
   */
  canRestart: boolean;
  /**
   * True when the match runs on the online grid: online, where both devices
   * run it, and ranked, whose plan is the online one (`rankedPlan`).
   */
  onlineGrid: boolean;
  /** Which levels are locked: the campaign's, or online the big maps. */
  locks: 'campaign' | 'online';
}

/** The rules of the next match, set up as `setup` says. */
export function matchRules(next: NextMatch, setup: RulesSetup): MatchRules {
  const kind = kindOf(next, setup.mode);
  const ranked = hasRankedStart(next) ? next.ranked : null;
  const rankedMatch = ranked?.match ?? null;
  return {
    kind,
    levelId: levelIdOf(next, setup.levelId),
    // A level picked for the match is fought against the computer.
    planMode:
      kind === 'two-players' || kind === 'online'
        ? 'two-players'
        : 'vs-computer',
    mission: next.kind === 'mission' ? next.mission : null,
    recording: recordingOf(kind, rankedMatch),
    evolves: kind === 'vs-computer' || kind === 'ghost',
    earns: kind !== 'ghost' && kind !== 'online',
    inSeries: kind === 'two-players' && setup.seriesLength !== 1,
    rankedMatch,
    ranked,
    canPause: rankedMatch === null,
    canRestart:
      kind !== 'endless' &&
      rankedMatch === null &&
      !(next.kind === 'online' && next.seat.seat === 1),
    onlineGrid: kind === 'online' || rankedMatch !== null,
    locks: kind === 'online' ? 'online' : 'campaign',
  };
}

/**
 * The next match as the store holds it: online the connection's match,
 * else the one-match setting.
 */
export function nextMatchOf(
  next: OneMatch,
  online: OnlineSeat | null
): NextMatch {
  return online === null ? next : { kind: 'online', seat: online };
}

/**
 * True for a run that can be raced as a ghost: one against the computer,
 * not on a training mission's level - its level is no replay's, and its
 * dummy no opponent to race.
 */
export function canRaceAsGhost(run: Replay): boolean {
  return (
    run.header.mode === 'vs-computer' && missionOf(run.header.levelId) === null
  );
}

/**
 * The one-match setting a rematch plays: the same, but not as a ranked
 * attempt, which is declared anew - or not.
 */
export function rematchOf(next: OneMatch): OneMatch {
  return hasRankedStart(next) ? { ...next, ranked: null } : next;
}

/** The variants a ranked start (ADR 0012) can be declared for. */
type RankedStart = Extract<NextMatch, { kind: 'daily' | 'endless' }>;

function hasRankedStart(next: NextMatch): next is RankedStart {
  return next.kind === 'daily' || next.kind === 'endless';
}

function kindOf(next: NextMatch, mode: GameMode): MatchKind {
  switch (next.kind) {
    case 'setup':
      return mode;
    case 'mission':
      return 'training';
    default:
      return next.kind;
  }
}

function levelIdOf(next: NextMatch, setupLevelId: string): string {
  switch (next.kind) {
    case 'setup':
      return setupLevelId;
    case 'ghost':
      return next.run.header.levelId;
    case 'mission':
      return missionById(next.mission).levelId;
    case 'online':
      return next.seat.levelId;
    default:
      return next.levelId;
  }
}

function recordingOf(
  kind: MatchKind,
  rankedMatch: RankedMatch | null
): RecordingRule {
  if (kind === 'online') {
    return 'online';
  }
  if (rankedMatch !== null) {
    return 'ranked';
  }
  // A ghost's and a training mission's levels are no replay's to record.
  return kind === 'vs-computer' || kind === 'daily' || kind === 'endless'
    ? 'local'
    : 'none';
}
