import type { League } from '../domain/league';
import type { Participant } from '../domain/participant';
import type { Team } from '../domain/team';
import type { ClubTeam, ClubTeams } from '../domain/team-season';
import type { ClubId } from '../domain/ids';
import { DbbObject } from './dbb-object';
import { mapClub } from './map-club';
import {
  chronological,
  distinctLeagues,
  mapGamesInLeagues,
  type GameInLeague,
} from './games';
import { byName } from './teams';

/**
 * A Verein's Teams as its recent Spiele show them
 * (`club/id/{clubId}/actualmatches`), each with the Ligen it played in.
 */
export function mapClubTeams(data: unknown): ClubTeams {
  const response = DbbObject.of(data, 'clubMatches');
  const club = mapClub(response.object('club'));
  const games = chronological(
    mapGamesInLeagues(response.optionalObjects('matches'))
  );
  return { club, teams: teamsOf(club.id, games) };
}

function teamsOf(
  clubId: ClubId,
  games: readonly GameInLeague[]
): readonly ClubTeam[] {
  const seen = new Map<number, { team: Team; leagues: League[] }>();
  for (const { game, league } of games) {
    for (const team of clubTeams(clubId, [game.home, game.away])) {
      const entry = seen.get(team.id) ?? { team, leagues: [] };
      entry.leagues.push(league);
      seen.set(team.id, entry);
    }
  }
  return [...seen.values()]
    .map(({ team, leagues }) => ({ team, leagues: distinctLeagues(leagues) }))
    .sort((a, b) => byName(a.team, b.team));
}

function clubTeams(
  clubId: ClubId,
  participants: readonly Participant[]
): readonly Team[] {
  return participants.flatMap((participant) =>
    participant.kind === 'team' && participant.team.clubId === clubId
      ? [participant.team]
      : []
  );
}
