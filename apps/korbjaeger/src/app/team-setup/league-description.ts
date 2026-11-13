import type { League } from '@wolsok/feat-shared-basketball-data';

/** What tells Ligen of one name apart: `Regionsliga · Region Braunschweig`. */
export function leagueDescription(league: League): string {
  return [league.division, league.district]
    .filter((part) => part !== undefined && part !== '')
    .join(' · ');
}
