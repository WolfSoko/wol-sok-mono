import type { PlayerStats } from '../lib/domain/game-report';

/** A player's Spielerwerte with every value 0, as the DBB sends what it lacks. */
export const NO_PLAYER_STATS: PlayerStats = {
  playingTimeSeconds: 0,
  points: 0,
  twoPointers: { made: 0, attempted: 0 },
  threePointers: { made: 0, attempted: 0 },
  freeThrows: { made: 0, attempted: 0 },
  rebounds: 0,
  assists: 0,
  steals: 0,
  turnovers: 0,
  blocks: 0,
  fouls: 0,
  efficiency: 0,
  startingFive: false,
};

/** Spielerwerte for a spec: `values`, every other one 0. */
export function playerStatsOf(values: Partial<PlayerStats>): PlayerStats {
  return { ...NO_PLAYER_STATS, ...values };
}
