import type { VereinId } from '@wolsok/feat-shared-basketball-data';

/** A Verein's colours as an Elternteil picked them, each `#rrggbb` in lower case. */
export interface Vereinsfarben {
  readonly primaer: string;
  readonly zweite?: string;
}

/** A Verein's colours, as the `Auswahl` holds them: by the Verein's DBB id. */
export interface VereinsfarbenWahl extends Vereinsfarben {
  readonly vereinId: VereinId;
}

/** A colour as the app stores it; the Firestore rules take the same. */
const FARBE = /^#[0-9a-f]{6}$/;

/** A colour that is no `#rrggbb`: refused, nothing stored. */
export class KeineFarbeError extends Error {
  public constructor(public readonly wert: string) {
    super(`Keine Farbe im Format #rrggbb: ${wert}`);
    this.name = 'KeineFarbeError';
  }
}

/** Whether `wert` is a colour as stored: `#rrggbb`, in lower case. */
export function istFarbe(wert: unknown): wert is string {
  return typeof wert === 'string' && FARBE.test(wert);
}

/**
 * `primaer` and `zweite` as stored: in lower case, `zweite` left out where
 * none is given. Throws `KeineFarbeError` for anything that is no
 * `#rrggbb`.
 */
export function vereinsfarbenAus(
  primaer: string,
  zweite?: string
): Vereinsfarben {
  return {
    primaer: farbeAus(primaer),
    ...(zweite !== undefined && { zweite: farbeAus(zweite) }),
  };
}

/**
 * How the `Auswahl` stores a Verein's colours: as one text, `#rrggbb` or
 * `#rrggbb,#rrggbb` with the second, so the Firestore rules check every
 * Verein's at once with one regular expression (a check per entry would
 * take more expressions than a request may evaluate).
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

/** Whether `a` and `b` are the same colours. */
export function gleicheFarben(a: Vereinsfarben, b: Vereinsfarben): boolean {
  return a.primaer === b.primaer && a.zweite === b.zweite;
}

function farbeAus(wert: string): string {
  const farbe = wert.toLowerCase();
  if (!istFarbe(farbe)) {
    throw new KeineFarbeError(wert);
  }
  return farbe;
}
