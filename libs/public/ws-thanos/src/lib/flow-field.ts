import { SimplexNoise } from './simplex-noise';
import { FLOW_FIELD } from './vaporizing-front';

/**
 * Pixels between two samples of the flow field. The noise changes over about a hundred pixels,
 * so interpolating between samples looks the same as computing it for every particle.
 */
export const FLOW_FIELD_CELL = 8;

/**
 * The noise field released particles flow along, sampled once on a grid over the effect canvas:
 * it only depends on the position, and looking it up is much cheaper than computing noise
 * for every particle in every frame. Both values are in [0, 1].
 */
export class FlowField {
  private readonly columns: number;
  private readonly rows: number;
  /** two values per grid point */
  private readonly values: Float32Array;

  public constructor(
    width: number,
    height: number,
    seed: number,
    private readonly cell = FLOW_FIELD_CELL,
    noise = new SimplexNoise()
  ) {
    this.columns = Math.ceil(width / cell) + 1;
    this.rows = Math.ceil(height / cell) + 1;
    this.values = new Float32Array(this.columns * this.rows * 2);
    const { frequency, xSeedOffset, ySeedDivisor } = FLOW_FIELD;
    const xZ = (seed + xSeedOffset) * frequency;
    const yY = (seed / ySeedDivisor) * frequency;
    for (let row = 0; row < this.rows; row++) {
      for (let column = 0; column < this.columns; column++) {
        const x = column * cell * frequency;
        const y = row * cell * frequency;
        const i = (row * this.columns + column) * 2;
        this.values[i] = noise.raw3D(x, y, xZ) * 0.5 + 0.5;
        this.values[i + 1] = noise.raw3D(x, yY, y) * 0.5 + 0.5;
      }
    }
  }

  /** writes both values at x, y into out, interpolated between the grid points */
  public sample(x: number, y: number, out: Float32Array): void {
    const { columns, rows, values } = this;
    const gridX = Math.min(Math.max(x / this.cell, 0), columns - 1.001);
    const gridY = Math.min(Math.max(y / this.cell, 0), rows - 1.001);
    const column = ~~gridX;
    const row = ~~gridY;
    const fx = gridX - column;
    const fy = gridY - row;
    const topLeft = (row * columns + column) * 2;
    const bottomLeft = topLeft + columns * 2;
    for (let channel = 0; channel < 2; channel++) {
      const top =
        values[topLeft + channel] +
        (values[topLeft + 2 + channel] - values[topLeft + channel]) * fx;
      const bottom =
        values[bottomLeft + channel] +
        (values[bottomLeft + 2 + channel] - values[bottomLeft + channel]) * fx;
      out[channel] = top + (bottom - top) * fy;
    }
  }
}
