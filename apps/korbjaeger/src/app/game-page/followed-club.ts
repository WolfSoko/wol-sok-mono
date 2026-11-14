import {
  isTeam,
  type Game,
  type Participant,
  type Team,
  type TeamId,
} from '@wolsok/feat-shared-basketball-data';

/** Whether `participant` is one of the followed Teams `followed`. */
export function isFollowed(
  participant: Participant,
  followed: readonly TeamId[] | undefined
): boolean {
  return followed?.some((team) => isTeam(participant, team)) ?? false;
}

/**
 * The Team of the side the Spiel page stands for, in its colours and its
 * breadcrumb: the side whose Team is followed, the home side where both
 * are; none where no side is, or Meine Teams are not read yet.
 */
export function followedSide(
  game: Game,
  followed: readonly TeamId[] | undefined
): Team | undefined {
  for (const participant of [game.home, game.away]) {
    if (participant.kind === 'team' && isFollowed(participant, followed)) {
      return participant.team;
    }
  }
  return undefined;
}
