import type { ClubId } from '@wolsok/feat-shared-basketball-data';
import { istFarbe, type Vereinsfarben } from './vereinsfarben';

/** A Verein's colours, as the `Auswahl` holds them: by the Verein's DBB id. */
export interface VereinsfarbenWahl extends Vereinsfarben {
  readonly vereinId: ClubId;
}

/** The colours `liste` holds for `verein`; `undefined` for none. */
export function vereinsfarbenVon(
  liste: readonly VereinsfarbenWahl[] | undefined,
  verein: ClubId
): VereinsfarbenWahl | undefined {
  return liste?.find(({ vereinId }) => vereinId === verein);
}

/** The order the `Auswahl` keeps its Vereinsfarben in: by the Verein's id. */
export function nachVerein(
  liste: readonly VereinsfarbenWahl[]
): readonly VereinsfarbenWahl[] {
  return [...liste].sort((a, b) => a.vereinId - b.vereinId);
}

/**
 * How the `AuswahlDokument` stores a Verein's colours: as one text,
 * `#rrggbb` or `#rrggbb,#rrggbb` with the second, so the Firestore rules
 * check every Verein's at once with one regular expression (a check per
 * entry would take more expressions than a request may evaluate).
 */
export function farbenText({ primaer, zweite }: Vereinsfarben): string {
  return zweite === undefined ? primaer : `${primaer},${zweite}`;
}

/** The colours `farbenText` stored in `text`; `undefined` where it is none. */
export function farbenAusText(text: unknown): Vereinsfarben | undefined {
  if (typeof text !== 'string') {
    return undefined;
  }
  const [primaer, zweite, ...mehr] = text.split(',');
  return istFarbe(primaer) &&
    (zweite === undefined || istFarbe(zweite)) &&
    mehr.length === 0
    ? { primaer, ...(zweite !== undefined && { zweite }) }
    : undefined;
}
