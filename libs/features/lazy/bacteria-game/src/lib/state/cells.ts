import type { Bacteria } from './player.model';

/**
 * A colony's bacteria as the painters read them: the cell and energy of
 * each by its index, the first `length` of them.
 */
export interface CellList {
  readonly length: number;
  readonly x: ArrayLike<number>;
  readonly y: ArrayLike<number>;
  readonly energy: ArrayLike<number>;
}

/** Room for this many bacteria before a colony's columns first grow. */
const START_CAPACITY = 64;

/**
 * A colony's bacteria in columns - each one's cell (whole numbers) and
 * energy at its index - rather than an object per bacterium: the CPU
 * simulation walks them every tick, and the painters read the columns as
 * they are. The order is the bacteria's, and every change keeps it.
 */
export class Cells implements CellList {
  public length = 0;
  public x = new Int32Array(START_CAPACITY);
  public y = new Int32Array(START_CAPACITY);
  public energy = new Float64Array(START_CAPACITY);

  /** Columns holding these bacteria, in their order. */
  public static of(bacterias: readonly Bacteria[]): Cells {
    const cells = new Cells();
    for (const { x, y, energy } of bacterias) {
      cells.push(x, y, energy);
    }
    return cells;
  }

  /**
   * Adds a bacterium at the end. The columns may grow: a caller holding
   * one of them reads it afresh afterwards.
   */
  public push(x: number, y: number, energy: number): void {
    if (this.length === this.x.length) {
      this.grow();
    }
    const at = this.length++;
    this.x[at] = x;
    this.y[at] = y;
    this.energy[at] = energy;
  }

  /** Keeps the bacteria whose mark is 0, in their order. */
  public keep(marks: Uint8Array): void {
    const { x, y, energy } = this;
    let kept = 0;
    for (let i = 0; i < this.length; i++) {
      if (marks[i] !== 0) {
        continue;
      }
      x[kept] = x[i];
      y[kept] = y[i];
      energy[kept] = energy[i];
      kept++;
    }
    this.length = kept;
  }

  /** The bacteria as objects - a copy, for specs and tools. */
  public toBacteria(): Bacteria[] {
    return Array.from({ length: this.length }, (_, i) => ({
      x: this.x[i],
      y: this.y[i],
      energy: this.energy[i],
    }));
  }

  private grow(): void {
    const capacity = this.x.length * 2;
    const x = new Int32Array(capacity);
    const y = new Int32Array(capacity);
    const energy = new Float64Array(capacity);
    x.set(this.x);
    y.set(this.y);
    energy.set(this.energy);
    this.x = x;
    this.y = y;
    this.energy = energy;
  }
}

/** A list of bacteria as objects, read as a {@link CellList}. */
export function cellListOf(bacterias: readonly Bacteria[]): CellList {
  return Cells.of(bacterias);
}
