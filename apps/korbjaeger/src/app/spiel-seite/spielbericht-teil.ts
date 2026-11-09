import type { Resource } from '@angular/core';
import {
  parteiName,
  type Kader,
  type SpielDetails,
  type SpielSeite,
  type Spielbericht,
  type TeamId,
} from '@wolsok/feat-shared-basketball-data';
import { istGefolgt } from './gefolgter-verein';
import { fehlerText, KEIN_SPIEL } from '../fehler/fehler-text';

/** One Kader with what heads it on the page. */
export interface KaderTeil {
  readonly seite: SpielSeite;
  /** The Team's name, or its side while the Spiel cannot be read. */
  readonly titel: string;
  readonly kader: Kader;
  /**
   * Whether the Team of this side is one of Meine Teams: only there can a
   * Kind be marked and is it highlighted (ADR 0019).
   */
  readonly gefolgt: boolean;
}

/** What the Spiel page shows of the Spielbericht. */
export type SpielberichtTeil =
  | { readonly art: 'laedt' }
  | { readonly art: 'fehler'; readonly text: string }
  | { readonly art: 'fehlt'; readonly text: string }
  | { readonly art: 'da'; readonly kader: readonly [KaderTeil, KaderTeil] };

/** What the page calls a Kader's side while the Spiel cannot be read. */
const SEITE: Readonly<Record<SpielSeite, string>> = {
  heim: 'Heim',
  gast: 'Gast',
};

/**
 * The Spielbericht part of the page, from its read (`bericht`) and the
 * Spiel's (`spiel`), which names the Kader and tells whose Team is one of
 * Meine Teams (`gefolgt`, none while they are not read). `undefined` where
 * the Spielbericht failed with the Spiel: the page's alert says why, once.
 */
export function spielberichtTeil(
  bericht: Resource<Spielbericht | undefined>,
  spiel: Resource<SpielDetails | undefined>,
  gefolgt: readonly TeamId[] = []
): SpielberichtTeil | undefined {
  const details = spiel.hasValue() ? spiel.value() : undefined;
  switch (bericht.status()) {
    case 'error':
      return spiel.status() === 'error'
        ? undefined
        : {
            art: 'fehler',
            text: fehlerText(bericht.error(), KEIN_SPIEL) ?? '',
          };
    case 'resolved':
    case 'local': {
      const gelesen = bericht.value();
      return gelesen === undefined
        ? { art: 'fehlt', text: fehltText(details) }
        : {
            art: 'da',
            kader: [
              teil('heim', gelesen, details, gefolgt),
              teil('gast', gelesen, details, gefolgt),
            ],
          };
    }
    default:
      return { art: 'laedt' };
  }
}

function teil(
  seite: SpielSeite,
  bericht: Spielbericht,
  details: SpielDetails | undefined,
  gefolgt: readonly TeamId[]
): KaderTeil {
  const partei = details?.spiel[seite];
  return {
    seite,
    titel: partei ? parteiName(partei) : SEITE[seite],
    kader: bericht[seite],
    gefolgt: partei !== undefined && istGefolgt(partei, gefolgt),
  };
}

/** Why there is no Spielbericht: one to come, or none for a Spiel off. */
function fehltText(details: SpielDetails | undefined): string {
  return details?.spiel.status.art === 'abgesagt'
    ? 'Das Spiel fällt aus, einen Spielbericht gibt es nicht.'
    : 'Noch kein Spielbericht. Schau später noch einmal vorbei.';
}
