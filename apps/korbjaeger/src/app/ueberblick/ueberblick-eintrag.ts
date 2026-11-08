import type {
  TeamId,
  TeamSaison,
  TeamUeberblick,
} from '@wolsok/feat-shared-basketball-data';
import { spielZeile, type SpielZeile } from '../spiel/spiel-zeile';

/** One of Meine Teams on the overview, as its card shows it. */
export interface UeberblickEintrag {
  readonly teamId: TeamId;
  readonly name: string;
  readonly naechstes?: SpielZeile;
  readonly ausfaelle: readonly SpielZeile[];
  readonly letztes?: SpielZeile;
}

/** `ueberblick` of `saison` (the lib's `teamUeberblick`) as lines. */
export function ueberblickEintrag(
  saison: TeamSaison,
  { naechstes, ausfaelle, letztes }: TeamUeberblick
): UeberblickEintrag {
  return {
    teamId: saison.team.id,
    name: saison.team.name,
    naechstes: naechstes && spielZeile(saison, naechstes),
    ausfaelle: ausfaelle.map((spiel) => spielZeile(saison, spiel)),
    letztes: letztes && spielZeile(saison, letztes),
  };
}
