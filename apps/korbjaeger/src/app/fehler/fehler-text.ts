import { isBasketballDataError } from '@wolsok/feat-shared-basketball-data';

/** What a screen says for an id that names no Team. */
export const KEIN_TEAM = 'Dieses Team kennt der DBB nicht.';

/**
 * What the page says when a read failed: nothing while none did,
 * `nichtGefunden` where the DBB knows no such Team or Liga, else that its
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
