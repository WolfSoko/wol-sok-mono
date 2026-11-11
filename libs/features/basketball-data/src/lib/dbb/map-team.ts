import type { Participant } from '../domain/participant';
import type { Team } from '../domain/team';
import type { DbbObject } from './dbb-object';

/**
 * A Team from the DBB's team reference (`homeTeam`, `team`, ...), by its
 * `teamPermanentId`; the season-specific `seasonTeamId` stays behind.
 */
export function mapTeam(team: DbbObject): Team {
  return {
    id: team.number('teamPermanentId'),
    name: team.string('teamname').trim(),
    clubId: team.number('clubId'),
  };
}

/**
 * One side of a Spiel: a Team, or a slot without one (no
 * `teamPermanentId`), named after what it waits for.
 */
export function mapParticipant(team: DbbObject): Participant {
  return team.optionalNumber('teamPermanentId') === undefined
    ? { kind: 'open', label: team.string('teamname').trim() }
    : { kind: 'team', team: mapTeam(team) };
}
