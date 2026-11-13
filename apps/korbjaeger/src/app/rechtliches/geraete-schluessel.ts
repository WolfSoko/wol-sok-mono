import { SELECTION_KEY } from '@wolsok/feat-korbjaeger-selection';
import { ANSWER_INDEX, ANSWER_PREFIX } from '@wolsok/feat-korbjaeger-answers';
import {
  SIGNED_IN_KEY,
  APPEARANCE_KEY,
  INSTALL_DISMISSED_KEY,
  CLEAR_CACHE_KEY,
} from '../device-storage';

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
  angemeldet: SIGNED_IN_KEY,
  zwischenspeicherLeeren: CLEAR_CACHE_KEY,
  installationAbgelehnt: INSTALL_DISMISSED_KEY,
  darstellung: APPEARANCE_KEY,
} as const;
