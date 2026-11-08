import { signal, type Signal } from '@angular/core';
import { auswahlFehlerText } from './auswahl-fehler-text';

/** A screen's changes to Meine Teams, with what it says when one fails. */
export interface AuswahlAenderung {
  /** The text of the last change's failure; none while it succeeded. */
  readonly fehler: Signal<string | undefined>;
  /** Runs `aenderung`, clearing the last failure first. */
  ausfuehren(aenderung: () => Promise<void>): Promise<void>;
}

/** Changes to Meine Teams for one control (`auswahlFehlerText`). */
export function auswahlAenderung(): AuswahlAenderung {
  const fehler = signal<string | undefined>(undefined);
  return {
    fehler: fehler.asReadonly(),
    ausfuehren: async (aenderung) => {
      fehler.set(undefined);
      try {
        await aenderung();
      } catch (grund: unknown) {
        fehler.set(auswahlFehlerText(grund));
      }
    },
  };
}
