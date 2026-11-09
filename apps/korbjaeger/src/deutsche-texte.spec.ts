// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * The app speaks German. A cheap guard against English slipping into what
 * a parent reads: no template (an `.html` file or a component's inline
 * `template`) holds one of the English words UI code tends to bring along.
 * Material icon ligatures (`<mat-icon>close</mat-icon>`) are names, not
 * text, and are left out.
 */

/** Common English UI words, as a label or a button would carry them. */
const ENGLISCHE_WOERTER = [
  'Loading',
  'Error',
  'Retry',
  'Settings',
  'Sign in',
  'Sign out',
  'Delete',
  'Cancel',
  'Save',
  'Back',
  'Close',
  'Follow',
  'Unfollow',
  'Remove',
  'Undo',
  'Search',
] as const;

const ENGLISCH = new RegExp(`\\b(${ENGLISCHE_WOERTER.join('|')})\\b`, 'g');
const ICON_LIGATUR = /<mat-icon\b[^>]*>[\s\S]*?<\/mat-icon>/g;
const INLINE_TEMPLATE = /\btemplate:\s*`([\s\S]*?)`/g;

/** The templates in a source file: the file itself, or its inline ones. */
function templatesIn(pfad: string, inhalt: string): string[] {
  if (pfad.endsWith('.html')) {
    return [inhalt];
  }
  return [...inhalt.matchAll(INLINE_TEMPLATE)].map((treffer) => treffer[1]);
}

/** The English words of the denylist in `template`, icon names left out. */
function englischeWoerter(template: string): string[] {
  const ohneIcons = template.replace(ICON_LIGATUR, '');
  return [...ohneIcons.matchAll(ENGLISCH)].map((treffer) => treffer[1]);
}

function quelldateien(ordner: string): string[] {
  return readdirSync(ordner, { withFileTypes: true }).flatMap((eintrag) => {
    const pfad = join(ordner, eintrag.name);
    if (eintrag.isDirectory()) {
      return quelldateien(pfad);
    }
    const istQuelle =
      /\.(ts|html)$/.test(eintrag.name) && !eintrag.name.endsWith('.spec.ts');
    return istQuelle ? [pfad] : [];
  });
}

const APP = fileURLToPath(new URL('./app', import.meta.url));

describe('German texts', () => {
  it('finds English words in a template', () => {
    expect(englischeWoerter('<button matButton>Retry</button>')).toEqual([
      'Retry',
    ]);
    expect(
      englischeWoerter(`<p [attr.aria-label]="'Sign in'">Loading…</p>`)
    ).toEqual(['Sign in', 'Loading']);
  });

  it('leaves icon names and words merely containing one alone', () => {
    expect(
      englischeWoerter(
        '<mat-icon aria-hidden="true">Close</mat-icon><p>Backofen</p>'
      )
    ).toEqual([]);
  });

  it('reads inline templates from a component, not its styles', () => {
    const quelle =
      'template: `<p>Speichern</p>`,\n  styles: `.Error { color: red; }`';

    expect(templatesIn('x.component.ts', quelle)).toEqual(['<p>Speichern</p>']);
  });

  it('finds templates to check', () => {
    const templates = quelldateien(APP).flatMap((pfad) =>
      templatesIn(pfad, readFileSync(pfad, 'utf8'))
    );

    expect(templates.length).toBeGreaterThan(30);
  });

  it('keeps English out of every template of the app', () => {
    const funde = quelldateien(APP).flatMap((pfad) =>
      templatesIn(pfad, readFileSync(pfad, 'utf8')).flatMap((template) =>
        englischeWoerter(template).map(
          (wort) => `${relative(APP, pfad)}: ${wort}`
        )
      )
    );

    expect(funde).toEqual([]);
  });
});
