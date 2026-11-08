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
