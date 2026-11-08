import type { Resource } from '@angular/core';
import {
  parteiName,
  type Kader,
  type SpielDetails,
  type SpielSeite,
  type Spielbericht,
} from '@wolsok/feat-shared-basketball-data';
import { fehlerText, KEIN_SPIEL } from '../fehler/fehler-text';
import { SEITE } from './spiel-kopf';

/** One Kader with what heads it on the page. */
export interface KaderTeil {
  readonly seite: SpielSeite;
  /** The Team's name, or its side while the Spiel cannot be read. */
  readonly titel: string;
  readonly kader: Kader;
}

/** What the Spiel page shows of the Spielbericht. */
export type SpielberichtTeil =
  | { readonly art: 'laedt' }
  | { readonly art: 'fehler'; readonly text: string }
  | { readonly art: 'fehlt'; readonly text: string }
  | { readonly art: 'da'; readonly kader: readonly [KaderTeil, KaderTeil] };

/**
 * The Spielbericht part of the page, from its read (`bericht`) and the
 * Spiel where that was read (`details`), which names the Kader.
 */
export function spielberichtTeil(
  bericht: Resource<Spielbericht | undefined>,
  details: SpielDetails | undefined
): SpielberichtTeil {
  switch (bericht.status()) {
    case 'error':
      return {
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
              teil('heim', gelesen, details),
              teil('gast', gelesen, details),
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
  details: SpielDetails | undefined
): KaderTeil {
  return {
    seite,
    titel: details ? parteiName(details.spiel[seite]) : SEITE[seite],
    kader: bericht[seite],
  };
}

/** Why there is no Spielbericht: one to come, or none for a Spiel off. */
function fehltText(details: SpielDetails | undefined): string {
  return details?.spiel.status.art === 'abgesagt'
    ? 'Das Spiel fällt aus, einen Spielbericht gibt es nicht.'
    : 'Noch kein Spielbericht. Schau später noch einmal vorbei.';
}
