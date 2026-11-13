import type {
  Game,
  GameStatus,
  TeamSeason,
} from '@wolsok/feat-shared-basketball-data';

/** MTV Wasbüttel's U12 Team, as the fixtures name it. */
export const WASBUETTEL_RST = {
  id: 313036,
  name: 'MTV Wasbüttel -RST-',
  clubId: 1837,
};
const GIFHORN = { id: 201500, name: 'MTV Gifhorn', clubId: 201500 };

/** A result, confirmed. */
export const PLAYED: GameStatus = {
  kind: 'played',
  result: { home: 78, away: 47 },
  confirmed: true,
};

/** A Spiel of `WASBUETTEL_RST` at home against MTV Gifhorn. */
export function gameOn(
  id: number,
  date: string,
  status: GameStatus = PLAYED
): Game {
  return {
    id,
    leagueId: 54862,
    matchday: 1,
    date,
    home: { kind: 'team', team: WASBUETTEL_RST },
    away: { kind: 'team', team: GIFHORN },
    status,
  };
}

/** `WASBUETTEL_RST`'s Saison with `games`, in date order. */
export function seasonOf(...games: Game[]): TeamSeason {
  return {
    team: WASBUETTEL_RST,
    club: { id: 1837, name: 'MTV Wasbüttel' },
    leagues: [],
    games,
  };
}
