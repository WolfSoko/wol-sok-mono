import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The app's own sources, for the specs that check every one of them (German
 * texts, colours from tokens, device keys in the privacy policy): one walk,
 * one rule what counts as a source.
 */
export const APP_FOLDER = fileURLToPath(new URL('../app', import.meta.url));

/**
 * The libs only the app uses, whose code is the app's as much as `src/app/`
 * (`LocalSelection`'s and `LocalAnswerCache`'s device keys): walked
 * with it, so no check misses them.
 */
export const OWN_LIB_FOLDERS: readonly string[] = [
  'korbjaeger-selection',
  'korbjaeger-answers',
].map((lib) =>
  fileURLToPath(
    new URL(`../../../../libs/features/${lib}/src`, import.meta.url)
  )
);

/** A component's inline template. */
export const INLINE_TEMPLATE = /\btemplate:\s*`([\s\S]*?)`/g;

/** A source of the app, read once. */
export interface AppSource {
  /** Its path below `src/app/`, or below a lib's `src/` (with the lib's folder). */
  readonly file: string;
  readonly content: string;
}

/**
 * The files below `src/app/` and the app's own libs (`OWN_LIB_FOLDERS`)
 * whose names end in one of `extensions` (`ts`, `html`, `scss`), specs, emulator
 * tests and test setups left out, read.
 */
export function appSources(extensions: readonly string[]): AppSource[] {
  const extension = new RegExp(`\\.(${extensions.join('|')})$`);
  return [
    ...sourcesIn(APP_FOLDER, APP_FOLDER, extension),
    ...OWN_LIB_FOLDERS.flatMap((folder) =>
      sourcesIn(folder, join(folder, '..', '..'), extension)
    ),
  ];
}

function sourcesIn(
  folder: string,
  base: string,
  extension: RegExp
): AppSource[] {
  return filesIn(folder)
    .filter(
      (path) =>
        extension.test(path) &&
        !/(\.(spec|emulator)|test-setup)\.ts$/.test(path)
    )
    .map((path) => ({
      file: relative(base, path),
      content: readFileSync(path, 'utf8'),
    }));
}

/** The first group of each match of `pattern` (a global pattern) in `text`. */
export function hits(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(pattern)].map((found) => found[1]);
}

function filesIn(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  });
}
