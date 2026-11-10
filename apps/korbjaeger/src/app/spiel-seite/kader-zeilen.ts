import {
  feldkoerbe,
  type Kader,
  type KaderEintrag,
  type Spielerwerte,
} from '@wolsok/feat-shared-basketball-data';
import type {
  Kind,
  MarkierbarerSpieler,
} from '@wolsok/feat-korbjaeger-auswahl';

/** What the Kader table shows of a player's Spielerwerte. */
export interface SpielerwerteZeile {
  readonly punkte: number;
  readonly feldkoerbe: number;
  /** Made of attempted, e.g. `2/7`. */
  readonly freiwuerfe: string;
  readonly fouls: number;
}

/** One player of a Kader, as the Spiel page lists them. */
export interface KaderZeile {
  /** Absent where the Spielbericht has none, and for an Anonymer Spieler. */
  readonly nummer?: string;
  /** The name as the DBB shows it, or "Anonymer Spieler". */
  readonly name: string;
  readonly anonym: boolean;
  /** Absent where the Verband records no Spielerwerte. */
  readonly werte?: SpielerwerteZeile;
  /**
   * The player to mark as a Kind: a named one of a followed Team's Kader
   * only (ADR 0019).
   */
  readonly spieler?: MarkierbarerSpieler;
  /** The player as a marked Kind, shown highlighted; only where `spieler` is. */
  readonly kind?: Kind;
}

/** What the page calls a player the DBB hides (ADR 0019). */
export const ANONYMER_SPIELER = 'Anonymer Spieler';

/**
 * The lines of `kader`, in the Spielbericht's order. Where the Kader is a
 * followed Team's, `kinder` are the marked Kinder: its named players can
 * be marked, and those marked are highlighted. Without `kinder` (another
 * Team's Kader) nobody is.
 */
export function kaderZeilen(
  kader: Kader,
  kinder?: readonly Kind[]
): readonly KaderZeile[] {
  return kader.eintraege.map((eintrag) => {
    const zeile = kaderZeile(eintrag);
    if (kinder === undefined || eintrag.art === 'anonym') {
      return zeile;
    }
    const { personId } = eintrag;
    const kind = kinder.find((markiert) => markiert.personId === personId);
    return {
      ...zeile,
      spieler: { art: 'benannt', personId },
      ...(kind && { kind }),
    };
  });
}

function kaderZeile(eintrag: KaderEintrag): KaderZeile {
  const werte = eintrag.spielerwerte && werteZeile(eintrag.spielerwerte);
  const mitWerten = werte === undefined ? {} : { werte };
  if (eintrag.art === 'anonym') {
    return { name: ANONYMER_SPIELER, anonym: true, ...mitWerten };
  }
  return {
    ...(eintrag.trikotnummer === undefined
      ? {}
      : { nummer: eintrag.trikotnummer }),
    name: `${eintrag.vorname} ${eintrag.nachname}`,
    anonym: false,
    ...mitWerten,
  };
}

function werteZeile(werte: Spielerwerte): SpielerwerteZeile {
  return {
    punkte: werte.punkte,
    feldkoerbe: feldkoerbe(werte),
    freiwuerfe: `${werte.freiwuerfe.getroffen}/${werte.freiwuerfe.versucht}`,
    fouls: werte.fouls,
  };
}
