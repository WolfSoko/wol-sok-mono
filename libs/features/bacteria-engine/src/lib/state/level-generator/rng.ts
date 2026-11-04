import { seeded } from '../geometry';

/** The seeded random numbers a generator draws from - see `seeded`. */
export class Rng {
  private readonly next: () => number;

  public constructor(seed: number) {
    this.next = seeded(seed);
  }

  /** A number from 0 up to 1. */
  public float(): number {
    return this.next();
  }

  /** A number from `min` up to `max`. */
  public range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** A whole number from `min` to `max`, both included. */
  public int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  public pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  /** True with the probability `p`. */
  public chance(p: number): boolean {
    return this.next() < p;
  }
}
