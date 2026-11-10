import {
  isTeam,
  type Game,
  type Participant,
  type Team,
  type TeamId,
  type ClubId,
} from '@wolsok/feat-shared-basketball-data';

/** Whether `partei` is one of the followed Teams `gefolgt`. */
export function istGefolgt(
  partei: Participant,
  gefolgt: readonly TeamId[] | undefined
): boolean {
  return gefolgt?.some((team) => isTeam(partei, team)) ?? false;
}

/**
 * The Team of the side the Spiel page stands for, in its colours and its
 * breadcrumb: the side whose Team is followed, the home side where both
 * are; none where no side is, or Meine Teams are not read yet.
 */
export function followedSide(
  spiel: Game,
  gefolgt: readonly TeamId[] | undefined
): Team | undefined {
  for (const partei of [spiel.home, spiel.away]) {
    if (partei.kind === 'team' && istGefolgt(partei, gefolgt)) {
      return partei.team;
    }
  }
  return undefined;
}

/** The Verein whose colours the Spiel page wears: that of `followedSide`. */
export function gefolgterVerein(
  spiel: Game,
  gefolgt: readonly TeamId[] | undefined
): ClubId | undefined {
  return followedSide(spiel, gefolgt)?.clubId;
}
