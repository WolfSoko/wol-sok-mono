import type { PersonId, TeamId } from './ids';
import { seiteVon, type Spiel } from './spiel';
import {
  istBenannt,
  type BenannterSpieler,
  type Kader,
  type Spielbericht,
} from './spielbericht';

/**
 * The named players of `kader` whose person is one of `personen` (the
 * marked Kinder), in the Kader's order. An Anonymer Spieler is never one:
 * it has no person id (ADR 0019).
 */
export function kinderImKader(
  kader: Kader,
  personen: readonly PersonId[]
): readonly BenannterSpieler[] {
  return kader.eintraege.filter(
    (eintrag): eintrag is BenannterSpieler =>
      istBenannt(eintrag) && personen.includes(eintrag.personId)
  );
}

/**
 * The Kader of `team`'s side in `bericht`, the Spielbericht of `spiel`;
 * none where the Team plays on neither side. A Kind is looked for only
 * there, in a followed Team's own Kader (ADR 0019).
 */
export function kaderDesTeams(
  bericht: Spielbericht,
  spiel: Spiel,
  team: TeamId
): Kader | undefined {
  const seite = seiteVon(spiel, team);
  return seite && bericht[seite];
}
