import type { ReadOptions } from '@wolsok/feat-shared-basketball-data';
import { older, type AsOf } from './as-of';

/**
 * One read as a screen makes it (`basketballDataResource`), which the
 * transport tells what it did:
 * - an answer of the proxy it would keep (`defer`): kept only once the
 *   read could map it (`abschliessen`), so an answer the adapter refuses
 *   never replaces the last good one;
 * - an answer it took from the last good ones instead (`ersetzt`): the
 *   read's `asOf`, the oldest where it took several.
 */
export class Reading {
  private oldest: AsOf | undefined;
  private deferred: Array<() => void> = [];

  /** Where the read took its last good answers: since when, and why. */
  public get asOf(): AsOf | undefined {
    return this.oldest;
  }

  /** The transport answered from a last good answer of `asOf`. */
  public replaced(asOf: AsOf): void {
    this.oldest = older(this.oldest, asOf);
  }

  /** The transport got an answer to keep, by `remember`, once read. */
  public defer(remember: () => void): void {
    this.deferred.push(remember);
  }

  /** The read mapped its answers: keeps them. */
  public complete(): void {
    const remember = this.deferred;
    this.deferred = [];
    remember.forEach((keep) => keep());
  }
}

/**
 * The options of a read in the app: the `Reading` the transport tells of
 * the answers it kept or took. A read without one keeps nothing and takes
 * no last good answer, since it could show no Stand.
 */
export interface KorbReadOptions extends ReadOptions {
  readonly reading?: Reading;
}
