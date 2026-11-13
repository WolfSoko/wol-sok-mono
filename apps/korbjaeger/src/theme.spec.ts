// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { appSources, INLINE_TEMPLATE, hits } from './testing/app-sources';

/**
 * The look is set once, in `styles.scss` (#2918): the components take their
 * colours from Material's system tokens (`--mat-sys-*`) and the app's own
 * (`--korb-*`), never from a colour of their own, so a Verein's colours and
 * dark mode reach every screen.
 */

const GLOBAL_STYLES = readFileSync(
  new URL('./styles.scss', import.meta.url),
  'utf8'
);

/** A string literal in TypeScript: single, double or back quotes. */
const STRING_LITERAL = String.raw`'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|\`[^\`]*\``;
/** A component's inline styles: one template literal, or an array of strings. */
const INLINE_STYLES = new RegExp(
  String.raw`\bstyles:\s*(\`[^\`]*\`|\[(?:\s*(?:${STRING_LITERAL})\s*,?)*\s*\])`,
  'g'
);
/** A style set in a template: `style`, `[style…]` or `[ngStyle]`, either quotes. */
const STYLE_IN_TEMPLATE =
  /\[?(?:style|ngStyle)(?:\.([\w-]+)(?:\.[\w-]+)?)?\]?\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

/** Every CSS colour name (CSS Color 4), from `color-name`. */
const COLOR_NAMES = new Set(
  Object.keys(
    createRequire(import.meta.url)('color-name') as Record<string, unknown>
  )
);
/** A declaration's value: what follows `property:` up to its end. */
const VALUE = /(?:^|[;{\s(])[\w-]+\s*:\s*([^;{}]+)/g;
const HEX_OR_FUNCTION =
  /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/g;
const WORD = /(?<![\w-])[a-zA-Z]+(?![\w-])/g;

const KORB_TOKEN = /var\(\s*(--korb-[\w-]+)/g;

/** Styles a template sets on its elements. */
function stylesInTemplate(template: string): string[] {
  return [...template.matchAll(STYLE_IN_TEMPLATE)].map(
    ([, property, doubleQuoted, singleQuoted]) => {
      const value = doubleQuoted ?? singleQuoted;
      // `[style.background]="…"` binds one property: read it as its declaration
      return property ? `${property}: ${value}` : value;
    }
  );
}

/** A string or a `url(…)`, else a block or line comment. */
const STRING_OR_COMMENT =
  /("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|\burl\([^)]*\))|\/\*[\s\S]*?\*\/|(?<!:)\/\/.*$/gm;

/** `style` without comments; strings and `url(…)` stay as they are. */
function withoutComments(style: string): string {
  return style.replace(
    STRING_OR_COMMENT,
    (_hits, stringLiteral?: string) => stringLiteral ?? ''
  );
}

/**
 * The styles of a source file: an `.scss` file itself; a component's inline
 * styles and those its inline template sets; those an `.html` template sets.
 */
function stylesIn(path: string, content: string): string[] {
  if (path.endsWith('.scss')) {
    return [content];
  }
  if (path.endsWith('.html')) {
    return stylesInTemplate(content);
  }
  return [
    ...hits(content, INLINE_STYLES),
    ...hits(content, INLINE_TEMPLATE).flatMap(stylesInTemplate),
  ];
}

/** Every component style of the app, with the file it is in, read once. */
const APP_STYLES = appSources(['ts', 'scss', 'html']).flatMap(
  ({ file, content }) =>
    stylesIn(file, content).map((style) => ({
      file,
      style: withoutComments(style),
    }))
);

/** The colours written out in the declarations' values of `style`. */
function colorsIn(style: string): string[] {
  return hits(style, VALUE).flatMap((value) => [
    ...[...value.matchAll(HEX_OR_FUNCTION)].map((found) => found[0]),
    ...[...value.matchAll(WORD)]
      .map((found) => found[0])
      .filter((word) => COLOR_NAMES.has(word.toLowerCase())),
  ]);
}

describe('the look', () => {
  it('finds component styles to check', () => {
    expect(APP_STYLES.length).toBeGreaterThan(10);
  });

  it('takes every colour of a component from a token', () => {
    const violations = APP_STYLES.flatMap(({ file, style }) =>
      colorsIn(style).map((color) => `${file}: ${color}`)
    );

    expect(violations).toEqual([]);
  });

  it('defines in styles.scss every app token a component uses', () => {
    const defined = new Set(
      hits(withoutComments(GLOBAL_STYLES), /(--korb-[\w-]+)\s*:/g)
    );
    const missing = APP_STYLES.flatMap(({ file, style }) =>
      hits(style, KORB_TOKEN)
        .filter((token) => !defined.has(token))
        .map((token) => `${file}: ${token}`)
    );

    expect(missing).toEqual([]);
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
    ])('catches %s', (style) => {
      expect(colorsIn(style)).not.toEqual([]);
    });

    it.each([
      'white-space: nowrap;',
      'color: var(--mat-sys-primary);',
      'border-width: var(--korb-linie-breite);',
      'grid-template-columns: 1fr auto;',
      '#add { display: block; }',
      'background: url(http://x/y.png) no-repeat;',
    ])('lets %s pass', (style) => {
      expect(colorsIn(style)).toEqual([]);
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
    ])('reads %s', (_kind, source, file) => {
      expect(stylesIn(file, source).flatMap(colorsIn)).not.toEqual([]);
    });

    it('keeps what follows a URL, while leaving comments out', () => {
      expect(
        colorsIn(
          withoutComments('a { background: url(http://x/y.png); color: #f00; }')
        )
      ).toEqual(['#f00']);
      expect(
        colorsIn(withoutComments('a { content: "x//y"; color: #f00; }'))
      ).toEqual(['#f00']);
      expect(
        colorsIn(
          withoutComments(
            'a { background: url(http://x//y.png); color: #f00; }'
          )
        )
      ).toEqual(['#f00']);
      expect(
        withoutComments('// --korb-weg: 1px\n/* --korb-auch: 2px */')
      ).not.toMatch(/--korb-/);
    });
  });
});
