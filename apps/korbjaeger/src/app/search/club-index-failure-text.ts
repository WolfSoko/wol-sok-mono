import { isBasketballDataError } from '@wolsok/feat-shared-basketball-data';
import { KeinInternetError } from '../basketball-data/kein-internet-error';
import { KEIN_INTERNET, KEINE_VERBINDUNG } from '../fehler/fehler-text';

/**
 * What the search says where the club list could not be loaded: the
 * list is the app's own (crawled from the DBB), so its failures name the
 * list, not the DBB.
 */
export const CLUB_INDEX_UNAVAILABLE =
  'Die Vereinsliste ist gerade nicht erreichbar. Bitte später noch einmal versuchen.';

/**
 * Why the club index could not be loaded: no internet (the browser says
 * so), no server reached, else that the list is not available.
 */
export function clubIndexFailureText(error: unknown): string {
  if (error instanceof KeinInternetError) {
    return KEIN_INTERNET;
  }
  if (isBasketballDataError(error, 'offline')) {
    return KEINE_VERBINDUNG;
  }
  return CLUB_INDEX_UNAVAILABLE;
}
