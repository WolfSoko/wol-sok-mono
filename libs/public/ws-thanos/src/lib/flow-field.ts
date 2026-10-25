import { SimplexNoise } from './simplex-noise';
import { FLOW_FIELD } from './vaporizing-front';
import { Wind, windOf } from './wind';

/**
 * Pixels between two samples of the flow field. The noise changes over about a hundred pixels,
 * so interpolating between samples looks the same as computing it for every particle.
 */
export const FLOW_FIELD_CELL = 8;

/**
 * The noise field released particles flow along, sampled once on a grid over the effect canvas:
 * it only depends on the position, and looking it up is much cheaper than computing noise
 * for every particle in every frame. Each grid point holds the push a particle gets
 * in a frame at 60 Hz, already turned into the wind.
 */
export class FlowField {
  private readonly columns: number;
  private readonly rows: number;
  private readonly cellsPerPixel: number;
  /** x and y of the push per grid point */
  private readonly values: Float32Array;

  /** @param noise only its raw3D() is used, frequency and range come from FLOW_FIELD */
  public constructor(
    width: number,
    height: number,
    seed: number,
    { cos, sin }: Wind = windOf(),
    cell = FLOW_FIELD_CELL,
    noise = new SimplexNoise()
  ) {
    this.columns = Math.ceil(width / cell) + 1;
    this.rows = Math.ceil(height / cell) + 1;
    this.cellsPerPixel = 1 / cell;
    this.values = new Float32Array(this.columns * this.rows * 2);
    const { frequency, xSeedOffset, ySeedDivisor } = FLOW_FIELD;
    const xZ = (seed + xSeedOffset) * frequency;
    const yY = (seed / ySeedDivisor) * frequency;
    for (let row = 0; row < this.rows; row++) {
      for (let column = 0; column < this.columns; column++) {
        const x = column * cell * frequency;
        const y = row * cell * frequency;
        // the default wind pushes right and up, both noise mapped to [0, 1]
        const pushX = noise.raw3D(x, y, xZ) * 0.5 + 0.5;
        const pushY = -(noise.raw3D(x, yY, y) * 0.5 + 0.5);
        const i = (row * this.columns + column) * 2;
        this.values[i] = cos * pushX - sin * pushY;
        this.values[i + 1] = sin * pushX + cos * pushY;
      }
    }
  }

  /** writes the push at x, y into out, interpolated between the grid points */
  public sample(x: number, y: number, out: Float32Array): void {
    const { columns, rows, values, cellsPerPixel } = this;
    const gridX = Math.min(Math.max(x * cellsPerPixel, 0), columns - 1.001);
    const gridY = Math.min(Math.max(y * cellsPerPixel, 0), rows - 1.001);
    const column = ~~gridX;
    const row = ~~gridY;
    const fx = gridX - column;
    const fy = gridY - row;
    const topLeft = (row * columns + column) * 2;
    const bottomLeft = topLeft + columns * 2;
    const topX = values[topLeft] + (values[topLeft + 2] - values[topLeft]) * fx;
    const topY =
      values[topLeft + 1] + (values[topLeft + 3] - values[topLeft + 1]) * fx;
    const bottomX =
      values[bottomLeft] + (values[bottomLeft + 2] - values[bottomLeft]) * fx;
    const bottomY =
      values[bottomLeft + 1] +
      (values[bottomLeft + 3] - values[bottomLeft + 1]) * fx;
    out[0] = topX + (bottomX - topX) * fy;
    out[1] = topY + (bottomY - topY) * fy;
  }
}
