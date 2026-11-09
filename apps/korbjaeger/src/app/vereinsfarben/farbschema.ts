import {
  argbFromHex,
  DynamicScheme,
  Hct,
  hexFromArgb,
  SchemeContent,
  TonalPalette,
} from '@material/material-color-utilities';

/**
 * The Material system colours the theme in `styles.scss` emits as
 * `light-dark()`, each a `--mat-sys-*` token: the ones a club's colours set.
 */
export const SYSTEMFARBEN = [
  'background',
  'error',
  'error-container',
  'inverse-on-surface',
  'inverse-primary',
  'inverse-surface',
  'on-background',
  'on-error',
  'on-error-container',
  'on-primary',
  'on-primary-container',
  'on-secondary',
  'on-secondary-container',
  'on-surface',
  'on-surface-variant',
  'on-tertiary',
  'on-tertiary-container',
  'outline',
  'outline-variant',
  'primary',
  'primary-container',
  'secondary',
  'secondary-container',
  'surface',
  'surface-bright',
  'surface-container',
  'surface-container-high',
  'surface-container-highest',
  'surface-container-low',
  'surface-container-lowest',
  'surface-dim',
  'surface-tint',
  'surface-variant',
  'tertiary',
  'tertiary-container',
] as const;

export type Systemfarbe = (typeof SYSTEMFARBEN)[number];

/** Each system colour as `#rrggbb`. */
export type Farbschema = Readonly<Record<Systemfarbe, string>>;

/** A Verein's colours as an Elternteil picked them, each `#rrggbb`. */
export interface Vereinsfarben {
  readonly primaer: string;
  readonly zweite?: string;
}

const HEX_FARBE = /^#[0-9a-f]{6}$/i;

/**
 * Material's standard contrast: every text on its ground reaches 4.5:1 and
 * every outline 3:1 (WCAG AA), for any colour, by shifting its tone.
 */
const STANDARD_KONTRAST = 0;

/**
 * The colour scheme of a Verein's colours: Material's "content" scheme,
 * which keeps the colour's hue and as much of its chroma as the tones allow,
 * with the second colour, where there is one, as the secondary family.
 */
export function farbschema(farben: Vereinsfarben, dunkel: boolean): Farbschema {
  const schema = schemaVon(farben, dunkel);
  return Object.fromEntries(
    SYSTEMFARBEN.map((farbe) => [farbe, hexFromArgb(schema[getterVon(farbe)])])
  ) as Record<Systemfarbe, string>;
}

/**
 * The `--mat-sys-*` declarations of a Verein's colours for light and dark at
 * once, so a scope's own `color-scheme` (`.anzeigetafel`) still turns them.
 */
export function farbschemaTokens(
  farben: Vereinsfarben
): Readonly<Record<`--mat-sys-${Systemfarbe}`, string>> {
  const hell = farbschema(farben, false);
  const dunkel = farbschema(farben, true);
  return Object.fromEntries(
    SYSTEMFARBEN.map((farbe) => [
      `--mat-sys-${farbe}`,
      `light-dark(${hell[farbe]}, ${dunkel[farbe]})`,
    ])
  ) as Record<`--mat-sys-${Systemfarbe}`, string>;
}

function schemaVon(farben: Vereinsfarben, dunkel: boolean): DynamicScheme {
  const quelle = Hct.fromInt(argbAus(farben.primaer));
  const inhalt = new SchemeContent(quelle, dunkel, STANDARD_KONTRAST);
  if (farben.zweite === undefined) {
    return inhalt;
  }
  return new DynamicScheme({
    sourceColorHct: quelle,
    variant: inhalt.variant,
    contrastLevel: STANDARD_KONTRAST,
    isDark: dunkel,
    primaryPalette: inhalt.primaryPalette,
    secondaryPalette: TonalPalette.fromInt(argbAus(farben.zweite)),
    tertiaryPalette: inhalt.tertiaryPalette,
    neutralPalette: inhalt.neutralPalette,
    neutralVariantPalette: inhalt.neutralVariantPalette,
    errorPalette: inhalt.errorPalette,
  });
}

function argbAus(hex: string): number {
  if (!HEX_FARBE.test(hex)) {
    throw new Error(`Keine Farbe im Format #rrggbb: ${hex}`);
  }
  return argbFromHex(hex);
}

type Getter = {
  [K in keyof DynamicScheme]: DynamicScheme[K] extends number ? K : never;
}[keyof DynamicScheme];

/** `surface-container-high` → `surfaceContainerHigh`. */
function getterVon(farbe: Systemfarbe): Getter {
  return farbe.replace(/-([a-z])/g, (_, buchstabe: string) =>
    buchstabe.toUpperCase()
  ) as Getter;
}
