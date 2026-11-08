import {
  nachNaechstemSpiel,
  teamUeberblick,
  type Spiel,
  type TeamId,
  type TeamSaison,
} from '@wolsok/feat-shared-basketball-data';
import { fehlerText } from '../team/fehler-text';
import { KEIN_TEAM, spielZeile, type SpielZeile } from '../team/team-spiele';

/** What the read of one followed Team gave: its Saison, or why not. */
export type TeamGelesen =
  | { readonly teamId: TeamId; readonly saison: TeamSaison }
  | { readonly teamId: TeamId; readonly fehler: unknown };

/** One of Meine Teams on the overview, as the page shows it. */
export type UeberblickEintrag =
  | {
      readonly art: 'team';
      readonly teamId: TeamId;
      readonly name: string;
      readonly naechstes?: SpielZeile;
      readonly ausfaelle: readonly SpielZeile[];
      readonly letztes?: SpielZeile;
    }
  | {
      readonly art: 'fehler';
      readonly teamId: TeamId;
      readonly name: string;
      readonly text: string;
    };

/**
 * The overview's entries on `heute`, by next Spiel (`nachNaechstemSpiel`):
 * Teams without one, and those whose read failed, follow in the order
 * they were followed.
 */
export function ueberblickEintraege(
  gelesen: readonly TeamGelesen[],
  heute: string
): readonly UeberblickEintrag[] {
  const sortierbar = gelesen.map((team) =>
    'saison' in team
      ? teamEintrag(team.saison, heute)
      : { eintrag: fehlerEintrag(team.teamId, team.fehler) }
  );
  return nachNaechstemSpiel(sortierbar, ({ naechstes }) => naechstes).map(
    ({ eintrag }) => eintrag
  );
}

interface Sortierbar {
  readonly eintrag: UeberblickEintrag;
  readonly naechstes?: Spiel;
}

function teamEintrag(saison: TeamSaison, heute: string): Sortierbar {
  const { naechstes, ausfaelle, letztes } = teamUeberblick(saison, heute);
  const zeile = (spiel: Spiel | undefined): SpielZeile | undefined =>
    spiel && spielZeile(saison, spiel);
  return {
    naechstes,
    eintrag: {
      art: 'team',
      teamId: saison.team.id,
      name: saison.team.name,
      naechstes: zeile(naechstes),
      ausfaelle: ausfaelle.map((spiel) => spielZeile(saison, spiel)),
      letztes: zeile(letztes),
    },
  };
}

function fehlerEintrag(teamId: TeamId, fehler: unknown): UeberblickEintrag {
  return {
    art: 'fehler',
    teamId,
    name: `Team ${teamId}`,
    // a read rejected without a reason failed all the same
    text: fehlerText(fehler ?? new Error('rejected'), KEIN_TEAM) ?? '',
  };
}
