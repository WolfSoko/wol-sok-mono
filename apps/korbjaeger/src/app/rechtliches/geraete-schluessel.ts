import { SELECTION_KEY } from '@wolsok/feat-korbjaeger-selection';
import { ANSWER_INDEX, ANSWER_PREFIX } from '@wolsok/feat-korbjaeger-answers';
import {
  ANGEMELDET_SCHLUESSEL,
  DARSTELLUNG_SCHLUESSEL,
  INSTALLATION_ABGELEHNT_SCHLUESSEL,
  ZWISCHENSPEICHER_LEEREN_SCHLUESSEL,
} from '../geraete-speicher';

/**
 * Every key (or key prefix) the app itself keeps in `localStorage`, as the
 * privacy policy lists them. `geraete-schluessel.spec.ts` fails on a key
 * in the app's code that is missing here, so a new one gets its line in
 * the policy too.
 */
export const GERAETE_SCHLUESSEL = {
  auswahl: SELECTION_KEY,
  antwortPraefix: ANSWER_PREFIX,
  antwortIndex: ANSWER_INDEX,
  angemeldet: ANGEMELDET_SCHLUESSEL,
  zwischenspeicherLeeren: ZWISCHENSPEICHER_LEEREN_SCHLUESSEL,
  installationAbgelehnt: INSTALLATION_ABGELEHNT_SCHLUESSEL,
  darstellung: DARSTELLUNG_SCHLUESSEL,
} as const;
