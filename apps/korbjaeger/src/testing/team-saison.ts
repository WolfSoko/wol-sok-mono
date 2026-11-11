import type {
  Game,
  GameStatus,
  League,
  TeamSeason,
} from '@wolsok/feat-shared-basketball-data';

/** MTV Wasbüttel's U12 Team, as the fixtures name it. */
export const WASBUETTEL_RST = {
  id: 313036,
  name: 'MTV Wasbüttel -RST-',
  clubId: 1837,
};
const GIFHORN = { id: 201500, name: 'MTV Gifhorn', clubId: 201500 };

/** A Hauptrunde, for a Spiel of a second Liga (`leagueId` of `spielOn`). */
export const HAUPTRUNDE_ID = 54900;

/** The Liga of every `spielOn` by default. */
const LIGA: League = {
  id: 54862,
  name: 'Regionsvorrunde Nord',
  association: { id: 7, name: 'Niedersachsen' },
  ageGroup: 'U12',
  gender: 'mixed',
  division: 'Kreisliga',
};

/** A result, confirmed. */
export const PLAYED: GameStatus = {
  kind: 'played',
  result: { home: 78, away: 47 },
  confirmed: true,
};

/** A Spiel of `WASBUETTEL_RST` at home against MTV Gifhorn. */
export function spielOn(
  id: number,
  datum: string,
  status: GameStatus = PLAYED,
  leagueId: number = LIGA.id
): Game {
  return {
    id,
    leagueId,
    matchday: 1,
    date: datum,
    home: { kind: 'team', team: WASBUETTEL_RST },
    away: { kind: 'team', team: GIFHORN },
    status,
  };
}

/** `WASBUETTEL_RST`'s Saison with `spiele`, in date order. */
export function saisonOf(...spiele: Game[]): TeamSeason {
  return {
    team: WASBUETTEL_RST,
    club: { id: 1837, name: 'MTV Wasbüttel' },
    leagues: [],
    games: spiele,
  };
}

/**
 * `saison` listing the Liga `ligaId` (by default that of `spielOn`) as one
 * the DBB keeps no Spielberichte for.
 */
export function inLigaWithoutGameReports(
  saison: TeamSeason,
  ligaId: number = LIGA.id
): TeamSeason {
  const liga: League = { ...LIGA, id: ligaId, withoutGameReports: true };
  return { ...saison, leagues: [liga] };
}
