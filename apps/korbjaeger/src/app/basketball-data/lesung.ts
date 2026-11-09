import type { ReadOptions } from '@wolsok/feat-shared-basketball-data';
import { aelterer, type Stand } from './stand';

/**
 * One read as a screen makes it (`basketballDataResource`), which the
 * transport tells what it did:
 * - an answer of the proxy it would keep (`vormerken`): kept only once the
 *   read could map it (`abschliessen`), so an answer the adapter refuses
 *   never replaces the last good one;
 * - an answer it took from the last good ones instead (`ersetzt`): the
 *   read's `stand`, the oldest where it took several.
 */
export class Lesung {
  private aeltester: Stand | undefined;
  private vorgemerkt: Array<() => void> = [];

  /** Where the read took its last good answers: since when, and why. */
  public get stand(): Stand | undefined {
    return this.aeltester;
  }

  /** The transport answered from a last good answer of `stand`. */
  public ersetzt(stand: Stand): void {
    this.aeltester = aelterer(this.aeltester, stand);
  }

  /** The transport got an answer to keep, by `merken`, once read. */
  public vormerken(merken: () => void): void {
    this.vorgemerkt.push(merken);
  }

  /** The read mapped its answers: keeps them. */
  public abschliessen(): void {
    const merken = this.vorgemerkt;
    this.vorgemerkt = [];
    merken.forEach((merke) => merke());
  }
}

/**
 * The options of a read in the app: the `Lesung` the transport tells of
 * the answers it kept or took. A read without one keeps nothing and takes
 * no last good answer, since it could show no Stand.
 */
export interface KorbReadOptions extends ReadOptions {
  readonly lesung?: Lesung;
}
