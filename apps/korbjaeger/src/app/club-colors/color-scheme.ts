import {
  argbFromHex,
  DynamicScheme,
  Hct,
  hexFromArgb,
  TonalPalette,
  Variant,
} from '@material/material-color-utilities';
import {
  clubColorsOf,
  type ClubColors,
} from '@wolsok/feat-korbjaeger-selection';

/**
 * Every Material system colour the theme in `styles.scss` emits as
 * `light-dark()`, each a `--mat-sys-*` token, so a Verein's colours set them
 * all (`system-colors.spec.ts` compiles the theme and keeps the list equal).
 */
export const SYSTEM_COLORS = [
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

export type SystemColor = (typeof SYSTEM_COLORS)[number];

/** The scheme's getters that give a colour (as ARGB). */
type ColorGetter = {
  [K in keyof DynamicScheme]: DynamicScheme[K] extends number ? K : never;
}[keyof DynamicScheme];

/** The scheme's getter of each system colour: `surface-container-high` → `surfaceContainerHigh`. */
const GETTER = Object.fromEntries(
  SYSTEM_COLORS.map((color) => [
    color,
    color.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()),
  ])
) as Record<SystemColor, ColorGetter>;

/** Each system colour as `#rrggbb`. */
export type ColorScheme = Readonly<Record<SystemColor, string>>;

/** Each system colour's token, as `light-dark(hell, dunkel)`. */
export type ColorSchemeTokens = Readonly<
  Record<`--mat-sys-${SystemColor}`, string>
>;

/**
 * A little above Material's standard contrast (0), so every text on its
 * ground reaches 4.5:1 and every outline 3:1 (WCAG AA), by shifting the
 * colour's tone: at 0, rounding to `#rrggbb` leaves some just below
 * (`#33ffdd` dark: on-primary-container 4.47:1). At 0.1, a one-off probe of
 * every eighth value per channel (32,768 colours) stayed at 4.53:1 or more;
 * `colorScheme.spec.ts` checks 216 of them, and the hard cases, on every run.
 * A sample, not a proof for all 16.7 million.
 */
const CONTRAST_LEVEL = 0.1;

/**
 * The colour scheme of a Verein's colours: Material's "content" scheme,
 * which keeps the colour's hue and as much of its chroma as the tones allow,
 * with the second colour, where there is one, as the secondary family.
 */
export function colorScheme(colors: ClubColors, dark: boolean): ColorScheme {
  const scheme = schemeOf(colors, dark);
  return Object.fromEntries(
    SYSTEM_COLORS.map((color) => [color, hexFromArgb(scheme[GETTER[color]])])
  ) as ColorScheme;
}

/**
 * The `--mat-sys-*` declarations of a Verein's colours for light and dark at
 * once, so a scope's own `color-scheme` (`.anzeigetafel`) still turns them.
 */
export function colorSchemeTokens(colors: ClubColors): ColorSchemeTokens {
  const light = colorScheme(colors, false);
  const dark = colorScheme(colors, true);
  return Object.fromEntries(
    SYSTEM_COLORS.map((color) => [
      `--mat-sys-${color}`,
      `light-dark(${light[color]}, ${dark[color]})`,
    ])
  ) as ColorSchemeTokens;
}

function schemeOf(colors: ClubColors, dark: boolean): DynamicScheme {
  // checked as stored: what is no #rrggbb throws `NotAColorError`
  const { primary, secondary } = clubColorsOf(colors.primary, colors.secondary);
  return new DynamicScheme({
    sourceColorHct: Hct.fromInt(argbFromHex(primary)),
    variant: Variant.CONTENT,
    contrastLevel: CONTRAST_LEVEL,
    isDark: dark,
    // left out, the content scheme derives it from the first colour
    secondaryPalette:
      secondary === undefined
        ? undefined
        : TonalPalette.fromInt(argbFromHex(secondary)),
  });
}
