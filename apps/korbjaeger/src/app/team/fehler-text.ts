import { isBasketballDataError } from '@wolsok/feat-shared-basketball-data';

/**
 * What the page says when a read failed: `nichtGefunden` where the DBB
 * knows no such Team or Liga, else that its data could not be read or the
 * DBB not reached.
 */
export function fehlerText(error: unknown, nichtGefunden: string): string {
  if (isBasketballDataError(error, 'not-found')) {
    return nichtGefunden;
  }
  if (isBasketballDataError(error, 'unexpected-shape')) {
    return 'Die Daten des DBB ließen sich nicht lesen. Bitte später noch einmal versuchen.';
  }
  return 'Der DBB ist gerade nicht erreichbar. Bitte später noch einmal versuchen.';
}
