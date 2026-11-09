/** A Verein's colours as an Elternteil picked them, each `#rrggbb` in lower case. */
export interface Vereinsfarben {
  readonly primaer: string;
  readonly zweite?: string;
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
