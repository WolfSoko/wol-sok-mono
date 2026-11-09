import { argbFromHex, Hct } from '@material/material-color-utilities';
import {
  farbschema,
  farbschemaTokens,
  SYSTEMFARBEN,
  type Farbschema,
  type Systemfarbe,
} from './farbschema';

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
  const [hell, dunkel] = [helligkeit(a), helligkeit(b)].sort((x, y) => y - x);
  return (hell + 0.05) / (dunkel + 0.05);
}

/** The hue in degrees (HCT, as Material keeps it). */
function farbton(hex: string): number {
  return Hct.fromInt(argbFromHex(hex)).hue;
}

const FLAECHEN: readonly Systemfarbe[] = [
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
const TEXT_PAARE: readonly (readonly [Systemfarbe, Systemfarbe])[] = [
  ['on-primary', 'primary'],
  ['on-primary-container', 'primary-container'],
  ['on-secondary', 'secondary'],
  ['on-secondary-container', 'secondary-container'],
  ['on-tertiary', 'tertiary'],
  ['on-tertiary-container', 'tertiary-container'],
  ...(['primary', 'secondary', 'tertiary'] as const).flatMap((familie) =>
    (['', '-variant'] as const).map(
      (art) => [`on-${familie}-fixed${art}`, `${familie}-fixed`] as const
    )
  ),
  ['on-error', 'error'],
  ['on-error-container', 'error-container'],
  ['on-background', 'background'],
  ['inverse-on-surface', 'inverse-surface'],
  ['inverse-primary', 'inverse-surface'],
  ...FLAECHEN.flatMap((flaeche) =>
    (['on-surface', 'on-surface-variant', 'primary'] as const).map(
      (text) => [text, flaeche] as const
    )
  ),
];

/** A control's edge on a ground: 3:1 (WCAG AA for UI components). */
const UI_PAARE: readonly (readonly [Systemfarbe, Systemfarbe])[] = FLAECHEN.map(
  (flaeche) => ['outline', flaeche] as const
);

/**
 * The 12 presets of the bottom sheet (#2918) and colours that are hard to
 * keep readable: very light, very dark, saturated.
 */
const FARBEN = [
  '#c8102e', // Rot
  '#1d4ed8', // Königsblau
  '#0b1f4b', // Marine
  '#007a3d', // Grün
  '#ffd700', // Gelb
  '#000000', // Schwarz
  '#ffffff', // Weiß
  '#f57c00', // Orange
  '#6a1b9a', // Lila
  '#7a003c', // Weinrot
  '#4fc3f7', // Himmelblau
  '#808080', // Grau
  '#00ff00',
  '#ff00ff',
  '#fffde7',
];

function paarePruefen(
  schema: Farbschema,
  paare: readonly (readonly [Systemfarbe, Systemfarbe])[],
  mindestens: number
): string[] {
  return paare
    .map(([vorne, hinten]) => ({
      vorne,
      hinten,
      wert: kontrast(schema[vorne], schema[hinten]),
    }))
    .filter(({ wert }) => wert < mindestens)
    .map(
      ({ vorne, hinten, wert }) => `${vorne} on ${hinten}: ${wert.toFixed(2)}`
    );
}

describe('farbschema', () => {
  describe.each(FARBEN)('for %s', (primaer) => {
    it.each([false, true])(
      'keeps every text readable on its ground (dark: %s)',
      (dunkel) => {
        const schema = farbschema({ primaer }, dunkel);

        expect(paarePruefen(schema, TEXT_PAARE, 4.5)).toEqual([]);
        expect(paarePruefen(schema, UI_PAARE, 3)).toEqual([]);
      }
    );
  });

  it('gives every Material system colour as #rrggbb', () => {
    const schema = farbschema({ primaer: '#c8102e' }, false);

    expect(Object.keys(schema).sort()).toEqual([...SYSTEMFARBEN].sort());
    for (const wert of Object.values(schema)) {
      expect(wert).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('shifts the tone of a colour too light for a light ground', () => {
    const hell = farbschema({ primaer: '#ffd700' }, false);

    // that it still reads on its ground, the contrast check above shows
    expect(hell.primary).not.toBe('#ffd700');
  });

  it('keeps the club’s hue', () => {
    const rot = farbschema({ primaer: '#c8102e' }, false).primary;

    expect(Math.abs(farbton(rot) - farbton('#c8102e'))).toBeLessThan(5);
  });

  it('takes the second colour for the secondary family', () => {
    const ohne = farbschema({ primaer: '#c8102e' }, false);
    const mit = farbschema({ primaer: '#c8102e', zweite: '#1d4ed8' }, false);

    expect(mit.primary).toBe(ohne.primary);
    expect(mit.secondary).not.toBe(ohne.secondary);
    expect(Math.abs(farbton(mit.secondary) - farbton('#1d4ed8'))).toBeLessThan(
      5
    );
  });

  it('refuses what is no #rrggbb colour', () => {
    expect(() => farbschema({ primaer: 'red' }, false)).toThrow();
    expect(() =>
      farbschema({ primaer: '#c8102e', zweite: '#12' }, false)
    ).toThrow();
  });
});

describe('farbschemaTokens', () => {
  it('sets every system colour for light and dark at once', () => {
    const tokens = farbschemaTokens({ primaer: '#c8102e' });
    const hell = farbschema({ primaer: '#c8102e' }, false);
    const dunkel = farbschema({ primaer: '#c8102e' }, true);

    expect(Object.keys(tokens)).toHaveLength(SYSTEMFARBEN.length);
    expect(tokens['--mat-sys-primary']).toBe(
      `light-dark(${hell.primary}, ${dunkel.primary})`
    );
  });
});
