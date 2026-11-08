import { isBasketballDataError } from '@wolsok/feat-shared-basketball-data';

/** What a screen says for an id that names no Team. */
export const KEIN_TEAM = 'Dieses Team kennt der DBB nicht.';

/** What a screen says for an id that names no Liga. */
export const KEINE_LIGA = 'Diese Liga kennt der DBB nicht.';

/** What the Liga search says for a filter the DBB finds nothing for. */
export const KEINE_LIGEN = 'Für diese Auswahl kennt der DBB keine Ligen.';

/** What a screen says for an id that names no Spiel. */
export const KEIN_SPIEL = 'Dieses Spiel kennt der DBB nicht.';

/**
 * What the page says when a read failed: nothing while none did,
 * `nichtGefunden` where the DBB knows no such Team, Liga or Spiel, else that its
 * data could not be read or the DBB not reached.
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
  if (isBasketballDataError(error, 'unexpected-shape')) {
    return 'Die Daten des DBB ließen sich nicht lesen. Bitte später noch einmal versuchen.';
  }
  return 'Der DBB ist gerade nicht erreichbar. Bitte später noch einmal versuchen.';
}
