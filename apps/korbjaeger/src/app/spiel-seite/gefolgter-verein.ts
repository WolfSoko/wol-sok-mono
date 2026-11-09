import {
  istTeam,
  type Spiel,
  type SpielPartei,
  type TeamId,
  type VereinId,
} from '@wolsok/feat-shared-basketball-data';

/** Whether `partei` is one of the followed Teams `gefolgt`. */
export function istGefolgt(
  partei: SpielPartei,
  gefolgt: readonly TeamId[] | undefined
): boolean {
  return gefolgt?.some((team) => istTeam(partei, team)) ?? false;
}

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
    if (partei.art === 'team' && istGefolgt(partei, gefolgt)) {
      return partei.team.vereinId;
    }
  }
  return undefined;
}
