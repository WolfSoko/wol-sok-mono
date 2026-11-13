import { signal, type Signal } from '@angular/core';
import { selectionErrorText } from './selection-error-text';

/** A screen's changes to Meine Teams or Kinder, with what it says when one fails. */
export interface SelectionChange {
  /** The text of the last change's failure; none while it succeeded. */
  readonly error: Signal<string | undefined>;
  /**
   * Runs `aenderung`, clearing the last failure first; resolves with
   * whether it succeeded (never rejects).
   */
  run(change: () => Promise<void>): Promise<boolean>;
}

/**
 * Changes to Meine Teams or Kinder for one control or one page (the Spiel
 * page's `KIND_AENDERUNG`), with what each failure says (`selectionErrorText`).
 */
export function selectionChange(): SelectionChange {
  const error = signal<string | undefined>(undefined);
  return {
    error: error.asReadonly(),
    run: async (change) => {
      error.set(undefined);
      try {
        await change();
        return true;
      } catch (reason: unknown) {
        error.set(selectionErrorText(reason));
        return false;
      }
    },
  };
}
