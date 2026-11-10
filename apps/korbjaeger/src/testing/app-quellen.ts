import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The app's own sources, for the specs that check every one of them (German
 * texts, colours from tokens, device keys in the privacy policy): one walk,
 * one rule what counts as a source.
 */
export const APP_ORDNER = fileURLToPath(new URL('../app', import.meta.url));

/**
 * The libs only the app uses, whose code is the app's as much as `src/app/`
 * (`LokaleAuswahl`'s and `LokaleLetzteAntworten`'s device keys): walked
 * with it, so no check misses them.
 */
export const EIGENE_LIB_ORDNER: readonly string[] = [
  'korbjaeger-auswahl',
  'korbjaeger-antworten',
].map((lib) =>
  fileURLToPath(
    new URL(`../../../../libs/features/${lib}/src`, import.meta.url)
  )
);

/** A component's inline template. */
export const INLINE_TEMPLATE = /\btemplate:\s*`([\s\S]*?)`/g;

/** A source of the app, read once. */
export interface AppQuelle {
  /** Its path below `src/app/`, or below a lib's `src/` (with the lib's folder). */
  readonly datei: string;
  readonly inhalt: string;
}

/**
 * The files below `src/app/` and the app's own libs (`EIGENE_LIB_ORDNER`)
 * whose names end in one of `endungen` (`ts`, `html`, `scss`), specs, emulator
 * tests and test setups left out, read.
 */
export function appQuellen(endungen: readonly string[]): AppQuelle[] {
  const endung = new RegExp(`\\.(${endungen.join('|')})$`);
  return [
    ...quellenIn(APP_ORDNER, APP_ORDNER, endung),
    ...EIGENE_LIB_ORDNER.flatMap((ordner) =>
      quellenIn(ordner, join(ordner, '..', '..'), endung)
    ),
  ];
}

function quellenIn(ordner: string, basis: string, endung: RegExp): AppQuelle[] {
  return dateienIn(ordner)
    .filter(
      (pfad) =>
        endung.test(pfad) && !/(\.(spec|emulator)|test-setup)\.ts$/.test(pfad)
    )
    .map((pfad) => ({
      datei: relative(basis, pfad),
      inhalt: readFileSync(pfad, 'utf8'),
    }));
}

/** The first group of each match of `muster` (a global pattern) in `text`. */
export function treffer(text: string, muster: RegExp): string[] {
  return [...text.matchAll(muster)].map((gefunden) => gefunden[1]);
}

function dateienIn(ordner: string): string[] {
  return readdirSync(ordner, { withFileTypes: true }).flatMap((eintrag) => {
    const pfad = join(ordner, eintrag.name);
    return eintrag.isDirectory() ? dateienIn(pfad) : [pfad];
  });
}
