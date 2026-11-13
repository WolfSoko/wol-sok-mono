import { isBasketballDataError } from '@wolsok/feat-shared-basketball-data';
import { NoInternetError } from '../basketball-data/no-internet-error';

/** What a screen says for an id that names no Team. */
export const NO_TEAM = 'Dieses Team kennt der DBB nicht.';

/** What a screen says for an id that names no Verein. */
export const NO_CLUB = 'Diesen Verein kennt der DBB nicht.';

/** What a screen says for an id that names no Liga. */
export const NO_LEAGUE = 'Diese Liga kennt der DBB nicht.';

/** What the Team wizard says when the search offers no Verband at all. */
export const NO_ASSOCIATIONS = 'Der DBB nennt gerade keine Verbände.';

/** What the Team wizard says when a Verband offers no age group. */
export const NO_LEAGUES_IN_ASSOCIATION =
  'Für diesen Verband kennt der DBB keine Ligen.';

/** What the Team wizard says when an age group offers no gender. */
export const NO_LEAGUES_IN_AGE_GROUP =
  'Für diese Altersklasse kennt der DBB keine Ligen.';

/**
 * What the Liga search says when the DBB answers it as not found, or
 * finds no Liga for a filter.
 */
export const NO_LEAGUES = 'Für diese Auswahl kennt der DBB keine Ligen.';

/** What a screen says for an id that names no Spiel. */
export const NO_GAME = 'Dieses Spiel kennt der DBB nicht.';

/** What a screen says when the browser says it has no internet. */
export const NO_INTERNET =
  'Kein Internet. Bitte die Verbindung prüfen und noch einmal versuchen.';

/**
 * What a screen says when no server answered: no internet, or the server
 * down, which the browser cannot tell apart.
 */
export const NO_CONNECTION =
  'Keine Verbindung. Internet oder Server nicht erreichbar. Bitte noch einmal versuchen.';

/** What a screen says when the proxy reached no DBB (its 502). */
export const DBB_UNREACHABLE =
  'Der DBB ist gerade nicht erreichbar. Bitte später noch einmal versuchen.';

/**
 * What the page says when a read failed: nothing while none did,
 * `nichtGefunden` where the DBB knows no such Team, Liga or Spiel, that the
 * device has no internet (the browser says so) or reached no server, that the DBB's data could not be read, else that the
 * DBB was not reached.
 */
export function errorText(
  error: unknown,
  notFound: string
): string | undefined {
  if (error === undefined) {
    return undefined;
  }
  if (isBasketballDataError(error, 'not-found')) {
    return notFound;
  }
  if (error instanceof NoInternetError) {
    return NO_INTERNET;
  }
  if (isBasketballDataError(error, 'offline')) {
    return NO_CONNECTION;
  }
  if (isBasketballDataError(error, 'unexpected-shape')) {
    return 'Die Daten des DBB ließen sich nicht lesen. Bitte später noch einmal versuchen.';
  }
  return DBB_UNREACHABLE;
}
