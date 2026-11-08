import {
  feldkoerbe,
  type Kader,
  type KaderEintrag,
  type Spielerwerte,
} from '@wolsok/feat-shared-basketball-data';

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
}

/** What the page calls a player the DBB hides (ADR 0019). */
export const ANONYMER_SPIELER = 'Anonymer Spieler';

/** The lines of `kader`, in the Spielbericht's order. */
export function kaderZeilen(kader: Kader): readonly KaderZeile[] {
  return kader.eintraege.map(kaderZeile);
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
