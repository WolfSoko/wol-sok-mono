import type { SelectionList } from './selection-lists';

/**
 * The stored `Selection` was written by a newer version of the app. It is
 * left as it is: this version neither reads nor overwrites it.
 */
export class SelectionTooNewError extends Error {
  public constructor() {
    super('Auswahl: stored by a newer version of the app');
    this.name = 'SelectionTooNewError';
  }
}

/**
 * A change would take a list of the `Selection` over its cap
 * (`SELECTION_LIMITS`, which the Firestore rules hold too): it is refused,
 * nothing stored.
 */
export class SelectionFullError extends Error {
  public constructor(public readonly list: SelectionList) {
    super(`Auswahl: ${list} full`);
    this.name = 'SelectionFullError';
  }
}
