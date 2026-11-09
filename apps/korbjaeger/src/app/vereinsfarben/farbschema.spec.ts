import { argbFromHex, Hct } from '@material/material-color-utilities';
import {
  farbschema,
  farbschemaTokens,
  SYSTEMFARBEN,
  type Farbschema,
  type Systemfarbe,
} from './farbschema';
import { VORGABEN } from './vorgaben';
import { KeineFarbeError } from './vereinsfarben';

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

/** How far apart two colours' hues are, in degrees (HCT, as Material keeps them). */
function farbtonAbstand(a: string, b: string): number {
  const [x, y] = [a, b].map((hex) => Hct.fromInt(argbFromHex(hex)).hue);
  const abstand = Math.abs(x - y);
  return Math.min(abstand, 360 - abstand);
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
    (
      [
        'on-surface',
        'on-surface-variant',
        'primary',
        'secondary',
        'tertiary',
        'error',
      ] as const
    ).map((text) => [text, flaeche] as const)
  ),
];

/** A control's edge on a ground: 3:1 (WCAG AA for UI components). */
const UI_PAARE: readonly (readonly [Systemfarbe, Systemfarbe])[] = FLAECHEN.map(
  (flaeche) => ['outline', flaeche] as const
);

/**
 * The presets of the bottom sheet (#2918) and colours that are hard to keep
 * readable: very light, very dark, saturated.
 */
const FARBEN = [
  ...VORGABEN.map(({ farbe }) => farbe),
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
  it.each([false, true])(
    'keeps every text readable for a spread of 216 colours, first and second (dark: %s)',
    (dunkel) => {
      const fehler = STREUUNG.flatMap((farbe) => {
        const erste = farbschema({ primaer: farbe }, dunkel);
        const zweite = farbschema(
          { primaer: '#c8102e', zweite: farbe },
          dunkel
        );
        return [
          ...paarePruefen(erste, TEXT_PAARE, 4.5),
          ...paarePruefen(erste, UI_PAARE, 3),
          ...paarePruefen(zweite, TEXT_PAARE, 4.5),
        ].map((paar) => `${farbe}: ${paar}`);
      });

      expect(fehler).toEqual([]);
    }
  );

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

  describe.each(FARBEN)('with %s as the second colour', (zweite) => {
    it.each([false, true])(
      'keeps every text readable on its ground (dark: %s)',
      (dunkel) => {
        const schema = farbschema({ primaer: '#c8102e', zweite }, dunkel);

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

    expect(farbtonAbstand(rot, '#c8102e')).toBeLessThan(5);
  });

  it('takes the second colour for the secondary family', () => {
    const ohne = farbschema({ primaer: '#c8102e' }, false);
    const mit = farbschema({ primaer: '#c8102e', zweite: '#1d4ed8' }, false);

    expect(mit.primary).toBe(ohne.primary);
    expect(mit.secondary).not.toBe(ohne.secondary);
    expect(farbtonAbstand(mit.secondary, '#1d4ed8')).toBeLessThan(5);
  });

  it('refuses what is no #rrggbb colour', () => {
    expect(() => farbschema({ primaer: 'red' }, false)).toThrow(
      KeineFarbeError
    );
    expect(() =>
      farbschema({ primaer: '#c8102e', zweite: '#12' }, false)
    ).toThrow(KeineFarbeError);
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
