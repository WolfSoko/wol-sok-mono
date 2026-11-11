import {
  fieldGoals,
  recordedStats,
  type PlayerStats,
  type Roster,
  type RosterEntry,
  type Shots,
} from '@wolsok/feat-shared-basketball-data';
import { SECONDS_IN_MINUTE } from '@wolsok/utils-time';
import type {
  Child,
  MarkablePlayer,
} from '@wolsok/feat-korbjaeger-selection';

/**
 * What the Kader table shows of a player's Spielerwerte, one field a
 * column (`StatsColumnId`); which of them show, `statsColumns` decides.
 */
export interface PlayerStatsRow {
  /** Minutes and seconds, e.g. `28:44`. */
  readonly playingTime: string;
  readonly points: number;
  /** The hits, or made of attempted (`8/14`) where attempts are recorded. */
  readonly fieldGoals: string;
  /** As `fieldGoals`. */
  readonly threePointers: string;
  /** Made of attempted, e.g. `2/7`. */
  readonly freeThrows: string;
  readonly rebounds: number;
  readonly assists: number;
  readonly steals: number;
  readonly turnovers: number;
  readonly blocks: number;
  readonly fouls: number;
  readonly efficiency: number;
}

/** One player of a Kader, as the Spiel page lists them. */
export interface KaderZeile {
  /** Absent where the Spielbericht has none, and for an Anonymer Spieler. */
  readonly nummer?: string;
  /** The name as the DBB shows it, or "Anonymer Spieler". */
  readonly name: string;
  readonly anonym: boolean;
  /** Absent where the Verband records no Spielerwerte. */
  readonly werte?: PlayerStatsRow;
  /** Whether the player was in the starting five, where the DBB says so. */
  readonly starter: boolean;
  /**
   * The player to mark as a Kind: a named one of a followed Team's Kader
   * only (ADR 0019).
   */
  readonly spieler?: MarkablePlayer;
  /** The player as a marked Kind, shown highlighted; only where `spieler` is. */
  readonly kind?: Child;
}

/** What the page calls a player the DBB hides (ADR 0019). */
export const ANONYMER_SPIELER = 'Anonymer Spieler';

/**
 * The lines of `kader`, in the Spielbericht's order. Where the Kader is a
 * followed Team's, `kinder` are the marked Kinder: its named players can
 * be marked, and those marked are highlighted. Without `kinder` (another
 * Team's Kader) nobody is.
 */
export function kaderZeilen(
  kader: Roster,
  kinder?: readonly Child[]
): readonly KaderZeile[] {
  const { shotAttempts } = recordedStats(kader);
  return kader.entries.map((eintrag) => {
    const zeile = kaderZeile(eintrag, shotAttempts);
    if (kinder === undefined || eintrag.kind === 'anonymous') {
      return zeile;
    }
    const { personId } = eintrag;
    const kind = kinder.find((markiert) => markiert.personId === personId);
    return {
      ...zeile,
      spieler: { kind: 'named', personId },
      ...(kind && { kind }),
    };
  });
}

function kaderZeile(eintrag: RosterEntry, shotAttempts: boolean): KaderZeile {
  const stats = eintrag.playerStats;
  const mitWerten = {
    ...(stats && { werte: statsRow(stats, shotAttempts) }),
    starter: stats?.startingFive ?? false,
  };
  if (eintrag.kind === 'anonymous') {
    return { name: ANONYMER_SPIELER, anonym: true, ...mitWerten };
  }
  return {
    ...(eintrag.shirtNumber === undefined
      ? {}
      : { nummer: eintrag.shirtNumber }),
    name: `${eintrag.firstName} ${eintrag.lastName}`,
    anonym: false,
    ...mitWerten,
  };
}

function statsRow(stats: PlayerStats, shotAttempts: boolean): PlayerStatsRow {
  const shots = (taken: Shots): string =>
    shotAttempts ? madeOfAttempted(taken) : `${taken.made}`;
  return {
    playingTime: playingTime(stats.playingTimeSeconds),
    points: stats.points,
    fieldGoals: shots(fieldGoals(stats)),
    threePointers: shots(stats.threePointers),
    freeThrows: madeOfAttempted(stats.freeThrows),
    rebounds: stats.rebounds,
    assists: stats.assists,
    steals: stats.steals,
    turnovers: stats.turnovers,
    blocks: stats.blocks,
    fouls: stats.fouls,
    efficiency: stats.efficiency,
  };
}

function madeOfAttempted({ made, attempted }: Shots): string {
  return `${made}/${attempted}`;
}

/** A playing time as minutes and seconds: 1724 → `28:44`. */
export function playingTime(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(whole / SECONDS_IN_MINUTE);
  const rest = whole % SECONDS_IN_MINUTE;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}
