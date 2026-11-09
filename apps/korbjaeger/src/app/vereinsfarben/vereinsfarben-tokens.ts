import type { FarbschemaTokens } from './farbschema';
import type { Vereinsfarben } from '@wolsok/feat-korbjaeger-auswahl';

let farbschemaModul: Promise<typeof import('./farbschema')> | undefined;

/**
 * The `--mat-sys-*` tokens of `farben`. The colour maths (`farbschema.ts`,
 * Material's colour library) is a chunk of its own, loaded once and only
 * once a Verein has colours: most visitors never load it. A failed load
 * is tried again next time.
 */
export async function vereinsfarbenTokens(
  farben: Vereinsfarben
): Promise<FarbschemaTokens> {
  farbschemaModul ??= import('./farbschema').catch((fehler: unknown) => {
    farbschemaModul = undefined;
    throw fehler;
  });
  return (await farbschemaModul).farbschemaTokens(farben);
}
