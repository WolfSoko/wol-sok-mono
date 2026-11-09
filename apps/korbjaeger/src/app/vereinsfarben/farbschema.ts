import {
  argbFromHex,
  DynamicScheme,
  Hct,
  hexFromArgb,
  TonalPalette,
  Variant,
} from '@material/material-color-utilities';

/**
 * Every Material system colour the theme in `styles.scss` emits as
 * `light-dark()`, each a `--mat-sys-*` token, so a Verein's colours set them
 * all (`systemfarben.spec.ts` compiles the theme and keeps the list equal).
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
  'on-primary-fixed',
  'on-primary-fixed-variant',
  'on-secondary',
  'on-secondary-container',
  'on-secondary-fixed',
  'on-secondary-fixed-variant',
  'on-surface',
  'on-surface-variant',
  'on-tertiary',
  'on-tertiary-container',
  'on-tertiary-fixed',
  'on-tertiary-fixed-variant',
  'outline',
  'outline-variant',
  'primary',
  'primary-container',
  'primary-fixed',
  'primary-fixed-dim',
  'scrim',
  'secondary',
  'secondary-container',
  'secondary-fixed',
  'secondary-fixed-dim',
  'shadow',
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
  'tertiary-fixed',
  'tertiary-fixed-dim',
] as const;

export type Systemfarbe = (typeof SYSTEMFARBEN)[number];

/** The scheme's getters that give a colour (as ARGB). */
type FarbGetter = {
  [K in keyof DynamicScheme]: DynamicScheme[K] extends number ? K : never;
}[keyof DynamicScheme];

/** The scheme's getter of each system colour: `surface-container-high` → `surfaceContainerHigh`. */
const GETTER = Object.fromEntries(
  SYSTEMFARBEN.map((farbe) => [
    farbe,
    farbe.replace(/-([a-z])/g, (_, buchstabe: string) =>
      buchstabe.toUpperCase()
    ),
  ])
) as Record<Systemfarbe, FarbGetter>;

/** Each system colour as `#rrggbb`. */
export type Farbschema = Readonly<Record<Systemfarbe, string>>;

/** Each system colour's token, as `light-dark(hell, dunkel)`. */
export type FarbschemaTokens = Readonly<
  Record<`--mat-sys-${Systemfarbe}`, string>
>;

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
    SYSTEMFARBEN.map((farbe) => [farbe, hexFromArgb(schema[GETTER[farbe]])])
  ) as Farbschema;
}

/**
 * The `--mat-sys-*` declarations of a Verein's colours for light and dark at
 * once, so a scope's own `color-scheme` (`.anzeigetafel`) still turns them.
 */
export function farbschemaTokens(farben: Vereinsfarben): FarbschemaTokens {
  const hell = farbschema(farben, false);
  const dunkel = farbschema(farben, true);
  return Object.fromEntries(
    SYSTEMFARBEN.map((farbe) => [
      `--mat-sys-${farbe}`,
      `light-dark(${hell[farbe]}, ${dunkel[farbe]})`,
    ])
  ) as FarbschemaTokens;
}

function schemaVon(farben: Vereinsfarben, dunkel: boolean): DynamicScheme {
  return new DynamicScheme({
    sourceColorHct: Hct.fromInt(argbAus(farben.primaer)),
    variant: Variant.CONTENT,
    contrastLevel: STANDARD_KONTRAST,
    isDark: dunkel,
    // left out, the content scheme derives it from the first colour
    secondaryPalette:
      farben.zweite === undefined
        ? undefined
        : TonalPalette.fromInt(argbAus(farben.zweite)),
  });
}

function argbAus(hex: string): number {
  if (!HEX_FARBE.test(hex)) {
    throw new Error(`Keine Farbe im Format #rrggbb: ${hex}`);
  }
  return argbFromHex(hex);
}
