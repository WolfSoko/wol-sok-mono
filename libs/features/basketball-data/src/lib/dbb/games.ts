import type { League } from '../domain/league';
import { compareTipOff, type Game } from '../domain/game';
import type { DbbObject } from './dbb-object';
import { mapLeague } from './map-league';
import { mapGame } from './map-game';

/** A Spiel with the Liga its match object carries. */
export interface GameInLeague {
  readonly game: Game;
  readonly league: League;
}

/** The Spiele of match objects that carry their `ligaData`, as Team and Verein lists do. */
export function mapGamesInLeagues(
  matches: readonly DbbObject[]
): readonly GameInLeague[] {
  return matches.map((match) => ({
    game: mapGame(match),
    league: mapLeague(match.object('ligaData')),
  }));
}

/** Each Spiel once, by date and tip-off. */
export function chronological<T extends { readonly game: Game }>(
  entries: readonly T[]
): readonly T[] {
  const byId = new Map<number, T>();
  for (const entry of entries) {
    byId.set(entry.game.id, entry);
  }
  return [...byId.values()].sort(
    (a, b) => compareTipOff(a.game, b.game) || a.game.id - b.game.id
  );
}

/** Each Liga once, in the order given. */
export function distinctLeagues(leagues: readonly League[]): readonly League[] {
  return [
    ...new Map(leagues.map((league) => [league.id, league] as const)).values(),
  ];
}
