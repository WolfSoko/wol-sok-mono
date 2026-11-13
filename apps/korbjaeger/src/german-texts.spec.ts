// @vitest-environment node
import { appSources, INLINE_TEMPLATE, hits } from './testing/app-sources';

/*
 * The app speaks German. A cheap guard against English slipping into what
 * a parent reads: no template (an `.html` file or a component's inline
 * `template`) holds one of the English words UI code tends to bring along.
 * Material icon ligatures (`<mat-icon>close</mat-icon>`) are names, not
 * text, and are left out.
 */

/** Common English UI words, as a label or a button would carry them. */
const ENGLISH_WORDS = [
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

const ENGLISH = new RegExp(`\\b(${ENGLISH_WORDS.join('|')})\\b`, 'g');
const ICON_LIGATURE = /<mat-icon\b[^>]*>[\s\S]*?<\/mat-icon>/g;
/** The templates in a source file: the file itself, or its inline ones. */
function templatesIn(path: string, content: string): string[] {
  if (path.endsWith('.html')) {
    return [content];
  }
  return hits(content, INLINE_TEMPLATE);
}

/** The English words of the denylist in `template`, icon names left out. */
function englishWords(template: string): string[] {
  const withoutIcons = template.replace(ICON_LIGATURE, '');
  return [...withoutIcons.matchAll(ENGLISH)].map((match) => match[1]);
}

/** Every template of the app, with the file it is in, read once. */
const APP_TEMPLATES = appSources(['ts', 'html']).flatMap(({ file, content }) =>
  templatesIn(file, content).map((template) => ({ file, template }))
);

describe('German texts', () => {
  it('finds English words in a template', () => {
    expect(englishWords('<button matButton>Retry</button>')).toEqual(['Retry']);
    expect(
      englishWords(`<p [attr.aria-label]="'Sign in'">Loading…</p>`)
    ).toEqual(['Sign in', 'Loading']);
  });

  it('leaves icon names and words merely containing one alone', () => {
    expect(
      englishWords(
        '<mat-icon aria-hidden="true">Close</mat-icon><p>Backofen</p>'
      )
    ).toEqual([]);
  });

  it('reads inline templates from a component, not its styles', () => {
    const source =
      'template: `<p>Speichern</p>`,\n  styles: `.Error { color: red; }`';

    expect(templatesIn('x.component.ts', source)).toEqual(['<p>Speichern</p>']);
  });

  it('finds templates to check', () => {
    expect(APP_TEMPLATES.length).toBeGreaterThan(30);
  });

  it('keeps English out of every template of the app', () => {
    const finds = APP_TEMPLATES.flatMap(({ file, template }) =>
      englishWords(template).map((word) => `${file}: ${word}`)
    );

    expect(finds).toEqual([]);
  });
});
