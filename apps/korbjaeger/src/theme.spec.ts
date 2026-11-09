// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The look is set once, in `styles.scss` (#2918): the components take their
 * colours from Material's system tokens (`--mat-sys-*`) and the app's own
 * (`--korb-*`), never from a colour of their own, so a Verein's colours and
 * dark mode reach every screen.
 */

const APP = fileURLToPath(new URL('./app', import.meta.url));
const GLOBALE_STILE = readFileSync(
  new URL('./styles.scss', import.meta.url),
  'utf8'
);

/** A component's inline styles: one template literal, or an array of them. */
const INLINE_STILE = /\bstyles:\s*(`[\s\S]*?`|\[[\s\S]*?\])/g;
const INLINE_TEMPLATE = /\btemplate:\s*`([\s\S]*?)`/g;
/** A style set in a template: `style="…"` or a `[style…]` binding. */
const STIL_IM_TEMPLATE = /\[?style(?:\.[\w-]+)*\]?\s*=\s*"([^"]*)"/g;

/** A colour written out: hex, a colour function or a CSS colour name. */
const FARBE = new RegExp(
  [
    String.raw`#[0-9a-fA-F]{3,8}\b`,
    String.raw`\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(`,
    String.raw`(?<![\w-])(?:white|black|red|green|blue|yellow|orange|purple|gr[ae]y|silver|maroon|navy|teal|olive|lime|aqua|fuchsia|pink|brown)(?![\w-])`,
  ].join('|'),
  'g'
);

const KORB_TOKEN = /var\(\s*(--korb-[\w-]+)/g;

function treffer(text: string, muster: RegExp): string[] {
  return [...text.matchAll(muster)].map((treffer) => treffer[1]);
}

/** Styles a template sets on its elements. */
function stileImTemplate(template: string): string[] {
  return treffer(template, STIL_IM_TEMPLATE);
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

function quelldateien(ordner: string): string[] {
  return readdirSync(ordner, { withFileTypes: true }).flatMap((eintrag) => {
    const pfad = join(ordner, eintrag.name);
    if (eintrag.isDirectory()) {
      return quelldateien(pfad);
    }
    const istQuelle =
      /\.(ts|scss|html)$/.test(eintrag.name) &&
      !eintrag.name.endsWith('.spec.ts');
    return istQuelle ? [pfad] : [];
  });
}

/** Every component style of the app, with the file it is in, read once. */
const APP_STILE = quelldateien(APP).flatMap((pfad) =>
  stileIn(pfad, readFileSync(pfad, 'utf8')).map((stil) => ({
    datei: relative(APP, pfad),
    stil: stil.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''),
  }))
);

function farbenIn(stil: string): string[] {
  return [...stil.matchAll(FARBE)].map((treffer) => treffer[0]);
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
      [...GLOBALE_STILE.matchAll(/(--korb-[\w-]+)\s*:/g)].map(
        (treffer) => treffer[1]
      )
    );
    const fehlend = APP_STILE.flatMap(({ datei, stil }) =>
      [...stil.matchAll(KORB_TOKEN)]
        .map((treffer) => treffer[1])
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
    ])('catches %s', (stil) => {
      expect(farbenIn(stil)).not.toEqual([]);
    });

    it.each([
      'white-space: nowrap;',
      'color: var(--mat-sys-primary);',
      'background: var(--korb-sieg-container);',
      'grid-template-columns: 1fr auto;',
    ])('lets %s pass', (stil) => {
      expect(farbenIn(stil)).toEqual([]);
    });

    it.each([
      ['an inline style array', "styles: ['a { color: #f00 }']", 'x.ts'],
      ['a style attribute', 'template: `<p style="color: red">x</p>`', 'x.ts'],
      ['a style binding', `<p [style.background]="'#fff'">x</p>`, 'x.html'],
    ])('reads %s', (_art, quelle, datei) => {
      expect(stileIn(datei, quelle).flatMap(farbenIn)).not.toEqual([]);
    });
  });
});
