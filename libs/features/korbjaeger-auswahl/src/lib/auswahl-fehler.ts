import type { AuswahlListe } from './selection-lists';

/**
 * The stored `Auswahl` was written by a newer version of the app. It is
 * left as it is: this version neither reads nor overwrites it.
 */
export class AuswahlZuNeuError extends Error {
  public constructor() {
    super('Auswahl: stored by a newer version of the app');
    this.name = 'AuswahlZuNeuError';
  }
}

/**
 * A change would take a list of the `Auswahl` over its cap
 * (`AUSWAHL_GRENZEN`, which the Firestore rules hold too): it is refused,
 * nothing stored.
 */
export class AuswahlVollError extends Error {
  public constructor(public readonly liste: AuswahlListe) {
    super(`Auswahl: ${liste} full`);
    this.name = 'AuswahlVollError';
  }
}
