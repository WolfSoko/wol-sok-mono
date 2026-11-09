// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { appQuellen, INLINE_TEMPLATE, treffer } from './testing/app-quellen';

/**
 * The look is set once, in `styles.scss` (#2918): the components take their
 * colours from Material's system tokens (`--mat-sys-*`) and the app's own
 * (`--korb-*`), never from a colour of their own, so a Verein's colours and
 * dark mode reach every screen.
 */

const GLOBALE_STILE = readFileSync(
  new URL('./styles.scss', import.meta.url),
  'utf8'
);

/** A string literal in TypeScript: single, double or back quotes. */
const ZEICHENKETTE = String.raw`'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|\`[^\`]*\``;
/** A component's inline styles: one template literal, or an array of strings. */
const INLINE_STILE = new RegExp(
  String.raw`\bstyles:\s*(\`[^\`]*\`|\[(?:\s*(?:${ZEICHENKETTE})\s*,?)*\s*\])`,
  'g'
);
/** A style set in a template: `style`, `[style…]` or `[ngStyle]`, either quotes. */
const STIL_IM_TEMPLATE =
  /\[?(?:style|ngStyle)(?:\.([\w-]+)(?:\.[\w-]+)?)?\]?\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

/** Every CSS colour name (CSS Color 4), from `color-name`. */
const FARBNAMEN = new Set(
  Object.keys(
    createRequire(import.meta.url)('color-name') as Record<string, unknown>
  )
);
/** A declaration's value: what follows `property:` up to its end. */
const WERT = /(?:^|[;{\s(])[\w-]+\s*:\s*([^;{}]+)/g;
const HEX_ODER_FUNKTION =
  /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/g;
const WORT = /(?<![\w-])[a-zA-Z]+(?![\w-])/g;

const KORB_TOKEN = /var\(\s*(--korb-[\w-]+)/g;

/** Styles a template sets on its elements. */
function stileImTemplate(template: string): string[] {
  return [...template.matchAll(STIL_IM_TEMPLATE)].map(
    ([, eigenschaft, doppelt, einfach]) => {
      const wert = doppelt ?? einfach;
      // `[style.background]="…"` binds one property: read it as its declaration
      return eigenschaft ? `${eigenschaft}: ${wert}` : wert;
    }
  );
}

/** A string, then a block or line comment (`//` after a colon is a URL). */
const STRING_ODER_KOMMENTAR =
  /("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|\/\*[\s\S]*?\*\/|(?<!:)\/\/.*$/gm;

/** `stil` without comments; strings and `url(http://…)` stay as they are. */
function ohneKommentare(stil: string): string {
  return stil.replace(
    STRING_ODER_KOMMENTAR,
    (_treffer, zeichenkette?: string) => zeichenkette ?? ''
  );
}

/**
 * The styles of a source file: an `.scss` file itself; a component's inline
 * styles and those its inline template sets; those an `.html` template sets.
 */
function stileIn(pfad: string, inhalt: string): string[] {
  if (pfad.endsWith('.scss')) {
    return [inhalt];
  }
  if (pfad.endsWith('.html')) {
    return stileImTemplate(inhalt);
  }
  return [
    ...treffer(inhalt, INLINE_STILE),
    ...treffer(inhalt, INLINE_TEMPLATE).flatMap(stileImTemplate),
  ];
}

/** Every component style of the app, with the file it is in, read once. */
const APP_STILE = appQuellen(['ts', 'scss', 'html']).flatMap(
  ({ datei, inhalt }) =>
    stileIn(datei, inhalt).map((stil) => ({
      datei,
      stil: ohneKommentare(stil),
    }))
);

/** The colours written out in the declarations' values of `stil`. */
function farbenIn(stil: string): string[] {
  return treffer(stil, WERT).flatMap((wert) => [
    ...[...wert.matchAll(HEX_ODER_FUNKTION)].map((gefunden) => gefunden[0]),
    ...[...wert.matchAll(WORT)]
      .map((gefunden) => gefunden[0])
      .filter((wort) => FARBNAMEN.has(wort.toLowerCase())),
  ]);
}

describe('the look', () => {
  it('finds component styles to check', () => {
    expect(APP_STILE.length).toBeGreaterThan(10);
  });

  it('takes every colour of a component from a token', () => {
    const verstoesse = APP_STILE.flatMap(({ datei, stil }) =>
      farbenIn(stil).map((farbe) => `${datei}: ${farbe}`)
    );

    expect(verstoesse).toEqual([]);
  });

  it('defines in styles.scss every app token a component uses', () => {
    const definiert = new Set(
      treffer(ohneKommentare(GLOBALE_STILE), /(--korb-[\w-]+)\s*:/g)
    );
    const fehlend = APP_STILE.flatMap(({ datei, stil }) =>
      treffer(stil, KORB_TOKEN)
        .filter((token) => !definiert.has(token))
        .map((token) => `${datei}: ${token}`)
    );

    expect(fehlend).toEqual([]);
  });

  describe('the colour check itself', () => {
    it.each([
      'color: #fff;',
      'background: rgb(0 0 0 / 50%);',
      'border-color: hsl(30 100% 50%);',
      'color: white;',
      'fill: oklch(70% 0.1 30);',
      'color: tomato;',
      'background: cyan;',
      'color: color(srgb 1 0 0);',
    ])('catches %s', (stil) => {
      expect(farbenIn(stil)).not.toEqual([]);
    });

    it.each([
      'white-space: nowrap;',
      'color: var(--mat-sys-primary);',
      'border-width: var(--korb-linie-breite);',
      'grid-template-columns: 1fr auto;',
      '#add { display: block; }',
      'background: url(http://x/y.png) no-repeat;',
    ])('lets %s pass', (stil) => {
      expect(farbenIn(stil)).toEqual([]);
    });

    it.each([
      ['an inline style array', "styles: ['a { color: #f00 }']", 'x.ts'],
      ['a style attribute', 'template: `<p style="color: red">x</p>`', 'x.ts'],
      ['a style binding', `<p [style.background]="'#fff'">x</p>`, 'x.html'],
      [
        'an inline style array with brackets in a selector',
        "styles: ['a[href] { color: #f00 }']",
        'x.ts',
      ],
      [
        'a single-quoted style attribute',
        "<p style='color: red'>x</p>",
        'x.html',
      ],
      ['an ngStyle binding', `<p [ngStyle]="{ color: 'red' }">x</p>`, 'x.html'],
    ])('reads %s', (_art, quelle, datei) => {
      expect(stileIn(datei, quelle).flatMap(farbenIn)).not.toEqual([]);
    });

    it('keeps what follows a URL, while leaving comments out', () => {
      expect(
        farbenIn(
          ohneKommentare('a { background: url(http://x/y.png); color: #f00; }')
        )
      ).toEqual(['#f00']);
      expect(
        farbenIn(ohneKommentare('a { content: "x//y"; color: #f00; }'))
      ).toEqual(['#f00']);
      expect(
        ohneKommentare('// --korb-weg: 1px\n/* --korb-auch: 2px */')
      ).not.toMatch(/--korb-/);
    });
  });
});
