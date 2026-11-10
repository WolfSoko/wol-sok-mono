import { isBasketballDataError } from '@wolsok/feat-shared-basketball-data';
import { KeinInternetError } from '../basketball-data/kein-internet-error';

/** What a screen says for an id that names no Team. */
export const KEIN_TEAM = 'Dieses Team kennt der DBB nicht.';

/** What a screen says for an id that names no Verein. */
export const KEIN_VEREIN = 'Diesen Verein kennt der DBB nicht.';

/** What a screen says for an id that names no Liga. */
export const KEINE_LIGA = 'Diese Liga kennt der DBB nicht.';

/** What the Team wizard says when the search offers no Verband at all. */
export const KEINE_VERBAENDE = 'Der DBB nennt gerade keine Verbände.';

/** What the Team wizard says when a Verband offers no age group. */
export const KEINE_LIGEN_IM_VERBAND =
  'Für diesen Verband kennt der DBB keine Ligen.';

/** What the Team wizard says when an age group offers no gender. */
export const KEINE_LIGEN_IN_ALTERSKLASSE =
  'Für diese Altersklasse kennt der DBB keine Ligen.';

/**
 * What the Liga search says when the DBB answers it as not found, or
 * finds no Liga for a filter.
 */
export const KEINE_LIGEN = 'Für diese Auswahl kennt der DBB keine Ligen.';

/** What a screen says for an id that names no Spiel. */
export const KEIN_SPIEL = 'Dieses Spiel kennt der DBB nicht.';

/** What a screen says when the browser says it has no internet. */
export const KEIN_INTERNET =
  'Kein Internet. Bitte die Verbindung prüfen und noch einmal versuchen.';

/**
 * What a screen says when no server answered: no internet, or the server
 * down, which the browser cannot tell apart.
 */
export const KEINE_VERBINDUNG =
  'Keine Verbindung. Internet oder Server nicht erreichbar. Bitte noch einmal versuchen.';

/** What a screen says when the proxy reached no DBB (its 502). */
export const DBB_NICHT_ERREICHBAR =
  'Der DBB ist gerade nicht erreichbar. Bitte später noch einmal versuchen.';

/**
 * What the page says when a read failed: nothing while none did,
 * `nichtGefunden` where the DBB knows no such Team, Liga or Spiel, that the
 * device has no internet (the browser says so) or reached no server, that the DBB's data could not be read, else that the
 * DBB was not reached.
 */
export function fehlerText(
  error: unknown,
  nichtGefunden: string
): string | undefined {
  if (error === undefined) {
    return undefined;
  }
  if (isBasketballDataError(error, 'not-found')) {
    return nichtGefunden;
  }
  if (error instanceof KeinInternetError) {
    return KEIN_INTERNET;
  }
  if (isBasketballDataError(error, 'offline')) {
    return KEINE_VERBINDUNG;
  }
  if (isBasketballDataError(error, 'unexpected-shape')) {
    return 'Die Daten des DBB ließen sich nicht lesen. Bitte später noch einmal versuchen.';
  }
  return DBB_NICHT_ERREICHBAR;
}

/** What the club search says when the list of Vereine failed to load. */
export const VEREINSLISTE_NICHT_ERREICHBAR =
  'Die Liste der Vereine ist gerade nicht erreichbar. Bitte später noch einmal versuchen.';

/**
 * What the club search says when its list of Vereine failed to load:
 * nothing while it did not, that the device has no internet or reached no
 * server, else that the list is not available.
 */
export function vereinslisteFehlerText(error: unknown): string | undefined {
  if (error === undefined) {
    return undefined;
  }
  if (error instanceof KeinInternetError) {
    return KEIN_INTERNET;
  }
  if (isBasketballDataError(error, 'offline')) {
    return KEINE_VERBINDUNG;
  }
  return VEREINSLISTE_NICHT_ERREICHBAR;
}
