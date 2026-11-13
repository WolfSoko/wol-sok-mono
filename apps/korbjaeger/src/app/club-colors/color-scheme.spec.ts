import { argbFromHex, Hct } from '@material/material-color-utilities';
import {
  colorScheme,
  colorSchemeTokens,
  SYSTEM_COLORS,
  type ColorScheme,
  type SystemColor,
} from './color-scheme';
import { PRESETS } from './presets';
import { NotAColorError } from '@wolsok/feat-korbjaeger-selection';

/** WCAG 2.x contrast of two `#rrggbb` colours. */
function kontrast(a: string, b: string): number {
  const helligkeit = (hex: string): number => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const kanal = parseInt(hex.slice(i, i + 2), 16) / 255;
      return kanal <= 0.04045
        ? kanal / 12.92
        : ((kanal + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [light, dark] = [helligkeit(a), helligkeit(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** How far apart two colours' hues are, in degrees (HCT, as Material keeps them). */
function hueDistance(a: string, b: string): number {
  const [x, y] = [a, b].map((hex) => Hct.fromInt(argbFromHex(hex)).hue);
  const distance = Math.abs(x - y);
  return Math.min(distance, 360 - distance);
}

const SURFACES: readonly SystemColor[] = [
  'background',
  'surface',
  'surface-dim',
  'surface-bright',
  'surface-container-lowest',
  'surface-container-low',
  'surface-container',
  'surface-container-high',
  'surface-container-highest',
];

/** Text on a ground: 4.5:1 (WCAG AA for body text). */
const TEXT_PAARE: readonly (readonly [SystemColor, SystemColor])[] = [
  ['on-primary', 'primary'],
  ['on-primary-container', 'primary-container'],
  ['on-secondary', 'secondary'],
  ['on-secondary-container', 'secondary-container'],
  ['on-tertiary', 'tertiary'],
  ['on-tertiary-container', 'tertiary-container'],
  ...(['primary', 'secondary', 'tertiary'] as const).flatMap((familie) =>
    (['', '-variant'] as const).map(
      (child) => [`on-${familie}-fixed${child}`, `${familie}-fixed`] as const
    )
  ),
  ['on-error', 'error'],
  ['on-error-container', 'error-container'],
  ['on-background', 'background'],
  ['inverse-on-surface', 'inverse-surface'],
  ['inverse-primary', 'inverse-surface'],
  ...SURFACES.flatMap((surface) =>
    (
      [
        'on-surface',
        'on-surface-variant',
        'primary',
        'secondary',
        'tertiary',
        'error',
      ] as const
    ).map((text) => [text, surface] as const)
  ),
];

/** A control's edge on a ground: 3:1 (WCAG AA for UI components). */
const UI_PAARE: readonly (readonly [SystemColor, SystemColor])[] = SURFACES.map(
  (surface) => ['outline', surface] as const
);

/**
 * The presets of the bottom sheet (#2918) and colours that are hard to keep
 * readable: very light, very dark, saturated.
 */
const COLORS = [
  ...PRESETS.map(({ color }) => color),
  '#00ff00',
  '#ff00ff',
  '#fffde7',
  '#33ffdd', // fell to 4.47:1 at Material's standard contrast
];

/** Six values per channel, 51 apart. */
const STUFEN = [0, 51, 102, 153, 204, 255];

/** Every combination of `STUFEN`: 216 colours across the whole space. */
const STREUUNG = STUFEN.flatMap((r) =>
  STUFEN.flatMap((g) =>
    STUFEN.map(
      (b) =>
        `#${[r, g, b].map((kanal) => kanal.toString(16).padStart(2, '0')).join('')}`
    )
  )
);

function checkPairs(
  scheme: ColorScheme,
  paare: readonly (readonly [SystemColor, SystemColor])[],
  mindestens: number
): string[] {
  return paare
    .map(([vorne, hinten]) => ({
      vorne,
      hinten,
      value: kontrast(scheme[vorne], scheme[hinten]),
    }))
    .filter(({ value }) => value < mindestens)
    .map(
      ({ vorne, hinten, value }) => `${vorne} on ${hinten}: ${value.toFixed(2)}`
    );
}

describe('colorScheme', () => {
  it.each([false, true])(
    'keeps every text readable for a spread of 216 colours, first and second (dark: %s)',
    (dark) => {
      const error = STREUUNG.flatMap((color) => {
        const erste = colorScheme({ primary: color }, dark);
        const secondary = colorScheme(
          { primary: '#c8102e', secondary: color },
          dark
        );
        return [
          ...checkPairs(erste, TEXT_PAARE, 4.5),
          ...checkPairs(erste, UI_PAARE, 3),
          ...checkPairs(secondary, TEXT_PAARE, 4.5),
        ].map((paar) => `${color}: ${paar}`);
      });

      expect(error).toEqual([]);
    }
  );

  describe.each(COLORS)('for %s', (primary) => {
    it.each([false, true])(
      'keeps every text readable on its ground (dark: %s)',
      (dark) => {
        const scheme = colorScheme({ primary }, dark);

        expect(checkPairs(scheme, TEXT_PAARE, 4.5)).toEqual([]);
        expect(checkPairs(scheme, UI_PAARE, 3)).toEqual([]);
      }
    );
  });

  describe.each(COLORS)('with %s as the second colour', (secondary) => {
    it.each([false, true])(
      'keeps every text readable on its ground (dark: %s)',
      (dark) => {
        const scheme = colorScheme({ primary: '#c8102e', secondary }, dark);

        expect(checkPairs(scheme, TEXT_PAARE, 4.5)).toEqual([]);
        expect(checkPairs(scheme, UI_PAARE, 3)).toEqual([]);
      }
    );
  });

  it('gives every Material system colour as #rrggbb', () => {
    const scheme = colorScheme({ primary: '#c8102e' }, false);

    expect(Object.keys(scheme).sort()).toEqual([...SYSTEM_COLORS].sort());
    for (const value of Object.values(scheme)) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('shifts the tone of a colour too light for a light ground', () => {
    const light = colorScheme({ primary: '#ffd700' }, false);

    // that it still reads on its ground, the contrast check above shows
    expect(light.primary).not.toBe('#ffd700');
  });

  it('keeps the club’s hue', () => {
    const rot = colorScheme({ primary: '#c8102e' }, false).primary;

    expect(hueDistance(rot, '#c8102e')).toBeLessThan(5);
  });

  it('takes the second colour for the secondary family', () => {
    const without = colorScheme({ primary: '#c8102e' }, false);
    const mit = colorScheme(
      { primary: '#c8102e', secondary: '#1d4ed8' },
      false
    );

    expect(mit.primary).toBe(without.primary);
    expect(mit.secondary).not.toBe(without.secondary);
    expect(hueDistance(mit.secondary, '#1d4ed8')).toBeLessThan(5);
  });

  it('refuses what is no #rrggbb colour', () => {
    expect(() => colorScheme({ primary: 'red' }, false)).toThrow(
      NotAColorError
    );
    expect(() =>
      colorScheme({ primary: '#c8102e', secondary: '#12' }, false)
    ).toThrow(NotAColorError);
  });
});

describe('colorSchemeTokens', () => {
  it('sets every system colour for light and dark at once', () => {
    const tokens = colorSchemeTokens({ primary: '#c8102e' });
    const light = colorScheme({ primary: '#c8102e' }, false);
    const dark = colorScheme({ primary: '#c8102e' }, true);

    expect(Object.keys(tokens)).toHaveLength(SYSTEM_COLORS.length);
    expect(tokens['--mat-sys-primary']).toBe(
      `light-dark(${light.primary}, ${dark.primary})`
    );
  });
});
