import type { PersonId, SpielId } from './ids';

/** One player's numbers in one Spiel. */
export interface Spielerwerte {
  readonly punkte: number;
  readonly zweier: number;
  readonly dreier: number;
  readonly freiwuerfe: {
    readonly getroffen: number;
    readonly versucht: number;
  };
  readonly fouls: number;
}

/** A player on a Kader with a name: the only kind that can become a Kind. */
export interface BenannterSpieler {
  readonly art: 'benannt';
  readonly personId: PersonId;
  readonly vorname: string;
  readonly nachname: string;
  /** Absent where the Spielbericht has none. */
  readonly trikotnummer?: string;
  /** Absent where the Verband records no Spielerwerte. */
  readonly spielerwerte?: Spielerwerte;
}

/**
 * A player whose name the DBB hides because the family objected. Without
 * a person id, it cannot be told apart from another or marked as a Kind.
 */
export interface AnonymerSpieler {
  readonly art: 'anonym';
  /** Absent where the Verband records no Spielerwerte. */
  readonly spielerwerte?: Spielerwerte;
}

/** One line of a Kader. */
export type KaderEintrag = BenannterSpieler | AnonymerSpieler;

/** The players listed on a Spielbericht for one Team. */
export interface Kader {
  /**
   * Whether this Kader's Spielerwerte were recorded. A Kader whose numbers
   * are all 0 means they were not, never that nobody scored; its entries
   * then carry none. Decided per Kader, since one side's can be filled in
   * and the other's not.
   */
  readonly spielerwerteErfasst: boolean;
  readonly eintraege: readonly KaderEintrag[];
}

/** What the DBB records about a played Spiel. */
export interface Spielbericht {
  readonly spielId: SpielId;
  readonly heim: Kader;
  readonly gast: Kader;
}

/** Whether either Kader of a Spielbericht has Spielerwerte. */
export function spielerwerteErfasst(bericht: Spielbericht): boolean {
  return bericht.heim.spielerwerteErfasst || bericht.gast.spielerwerteErfasst;
}

/** Whether a Kader entry is a named player, so it can be marked as a Kind. */
export function istBenannt(eintrag: KaderEintrag): eintrag is BenannterSpieler {
  return eintrag.art === 'benannt';
}
