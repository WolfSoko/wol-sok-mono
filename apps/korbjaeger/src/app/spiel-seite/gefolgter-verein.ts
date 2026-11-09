import {
  istTeam,
  type Spiel,
  type TeamId,
  type VereinId,
} from '@wolsok/feat-shared-basketball-data';

/**
 * The Verein whose colours the Spiel page wears: that of the side whose
 * Team is followed, the home side where both are; none where no side is,
 * or Meine Teams are not read yet.
 */
export function gefolgterVerein(
  spiel: Spiel,
  gefolgt: readonly TeamId[] | undefined
): VereinId | undefined {
  for (const partei of [spiel.heim, spiel.gast]) {
    if (
      partei.art === 'team' &&
      gefolgt?.some((team) => istTeam(partei, team))
    ) {
      return partei.team.vereinId;
    }
  }
  return undefined;
}
