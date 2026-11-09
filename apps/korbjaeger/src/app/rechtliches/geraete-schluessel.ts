import { AUSWAHL_SCHLUESSEL } from '../auswahl/lokale-auswahl';
import {
  ANTWORT_INDEX,
  ANTWORT_PRAEFIX,
} from '../basketball-data/letzte-antworten';
import {
  ANGEMELDET_SCHLUESSEL,
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
  auswahl: AUSWAHL_SCHLUESSEL,
  antwortPraefix: ANTWORT_PRAEFIX,
  antwortIndex: ANTWORT_INDEX,
  angemeldet: ANGEMELDET_SCHLUESSEL,
  zwischenspeicherLeeren: ZWISCHENSPEICHER_LEEREN_SCHLUESSEL,
  installationAbgelehnt: INSTALLATION_ABGELEHNT_SCHLUESSEL,
} as const;
