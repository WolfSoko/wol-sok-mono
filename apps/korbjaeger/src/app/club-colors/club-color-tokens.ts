import type { ColorSchemeTokens } from './color-scheme';
import type { ClubColors } from '@wolsok/feat-korbjaeger-selection';

let colorSchemeModule: Promise<typeof import('./color-scheme')> | undefined;

/**
 * The `--mat-sys-*` tokens of `colors`. The colour maths (`color-scheme.ts`,
 * Material's colour library) is a chunk of its own, loaded once and only
 * once a Verein has colours: most visitors never load it. A failed load
 * is tried again next time.
 */
export async function clubColorTokens(
  colors: ClubColors
): Promise<ColorSchemeTokens> {
  colorSchemeModule ??= import('./color-scheme').catch((error: unknown) => {
    colorSchemeModule = undefined;
    throw error;
  });
  return (await colorSchemeModule).colorSchemeTokens(colors);
}
