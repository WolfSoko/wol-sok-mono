import { signal, type Signal } from '@angular/core';
import { auswahlFehlerText } from './auswahl-fehler-text';

/** A screen's changes to Meine Teams or Kinder, with what it says when one fails. */
export interface AuswahlAenderung {
  /** The text of the last change's failure; none while it succeeded. */
  readonly fehler: Signal<string | undefined>;
  /**
   * Runs `aenderung`, clearing the last failure first; resolves with
   * whether it succeeded (never rejects).
   */
  ausfuehren(aenderung: () => Promise<void>): Promise<boolean>;
}

/**
 * Changes to Meine Teams or Kinder for one control or one page (the Spiel
 * page's `KIND_AENDERUNG`), with what each failure says (`auswahlFehlerText`).
 */
export function auswahlAenderung(): AuswahlAenderung {
  const fehler = signal<string | undefined>(undefined);
  return {
    fehler: fehler.asReadonly(),
    ausfuehren: async (aenderung) => {
      fehler.set(undefined);
      try {
        await aenderung();
        return true;
      } catch (grund: unknown) {
        fehler.set(auswahlFehlerText(grund));
        return false;
      }
    },
  };
}
