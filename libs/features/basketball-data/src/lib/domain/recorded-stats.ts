import { fieldGoals, type PlayerStats, type Roster } from './game-report';

/**
 * Which of the Spielerwerte beyond points, field goals, free throws and
 * fouls a Kader records. The DBB sends every value for every player, as 0
 * where the Verband does not record it, so a value counts as recorded
 * where any player of the Kader has it.
 */
export interface RecordedStats {
  readonly playingTime: boolean;
  /** Field goal attempts, so shots read made of attempted. */
  readonly shotAttempts: boolean;
  readonly threePointers: boolean;
  readonly rebounds: boolean;
  readonly assists: boolean;
  readonly steals: boolean;
  readonly turnovers: boolean;
  readonly blocks: boolean;
  /** Only with `shotAttempts`: without them the DBB's value is wrong. */
  readonly efficiency: boolean;
  readonly startingFive: boolean;
}

/** What `recordedStats` gives a Kader without Spielerwerte. */
export const NONE_RECORDED: RecordedStats = {
  playingTime: false,
  shotAttempts: false,
  threePointers: false,
  rebounds: false,
  assists: false,
  steals: false,
  turnovers: false,
  blocks: false,
  efficiency: false,
  startingFive: false,
};

/** Which optional Spielerwerte `roster` records (see `RecordedStats`). */
export function recordedStats(roster: Roster): RecordedStats {
  const stats = roster.entries.flatMap((entry) =>
    entry.playerStats === undefined ? [] : [entry.playerStats]
  );
  const any = (has: (player: PlayerStats) => boolean): boolean =>
    stats.some(has);
  const shotAttempts = any((player) => fieldGoals(player).attempted > 0);
  return {
    playingTime: any((player) => player.playingTimeSeconds > 0),
    shotAttempts,
    threePointers: any(
      ({ threePointers }) =>
        threePointers.made > 0 || threePointers.attempted > 0
    ),
    rebounds: any((player) => player.rebounds > 0),
    assists: any((player) => player.assists > 0),
    steals: any((player) => player.steals > 0),
    turnovers: any((player) => player.turnovers > 0),
    blocks: any((player) => player.blocks > 0),
    efficiency: shotAttempts && any((player) => player.efficiency !== 0),
    startingFive: any((player) => player.startingFive),
  };
}
