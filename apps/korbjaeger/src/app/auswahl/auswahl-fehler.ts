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
  public constructor(public readonly liste: 'teams' | 'kinder') {
    super(`Auswahl: ${liste} full`);
    this.name = 'AuswahlVollError';
  }
}

/**
 * Offline, the account's selection was never read on this device: a
 * change could overwrite what the account holds, so it is refused until
 * the device was online once.
 */
export class AuswahlOfflineUnbekanntError extends Error {
  public constructor() {
    super('Auswahl: not read yet, and offline');
    this.name = 'AuswahlOfflineUnbekanntError';
  }
}
