/** A Verein's colours as an Elternteil picked them, each `#rrggbb` in lower case. */
export interface ClubColors {
  readonly primary: string;
  readonly secondary?: string;
}

/** A colour as the app stores it; the Firestore rules take the same. */
const COLOR = /^#[0-9a-f]{6}$/;

/** A colour that is no `#rrggbb`: refused, nothing stored. */
export class NotAColorError extends Error {
  public constructor(public readonly value: string) {
    super(`Keine Farbe im Format #rrggbb: ${value}`);
    this.name = 'NotAColorError';
  }
}

/** Whether `value` is a colour as stored: `#rrggbb`, in lower case. */
export function isColor(value: unknown): value is string {
  return typeof value === 'string' && COLOR.test(value);
}

/**
 * `primary` and `secondary` as stored: in lower case, `secondary` left out where
 * none is given. Throws `NotAColorError` for anything that is no
 * `#rrggbb`.
 */
export function clubColorsOf(primary: string, secondary?: string): ClubColors {
  return {
    primary: colorOf(primary),
    ...(secondary !== undefined && { secondary: colorOf(secondary) }),
  };
}

/** Whether `a` and `b` are the same colours. */
export function sameColors(a: ClubColors, b: ClubColors): boolean {
  return a.primary === b.primary && a.secondary === b.secondary;
}

function colorOf(value: string): string {
  const color = value.toLowerCase();
  if (!isColor(color)) {
    throw new NotAColorError(value);
  }
  return color;
}
