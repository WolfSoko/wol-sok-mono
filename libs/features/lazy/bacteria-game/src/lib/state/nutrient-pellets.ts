import { Nutrient } from './bacteria-simulation';
import { GameBalance } from './game-balance';

/**
 * The nutrient pellets of a match: where they are, how much is left in each
 * and when an eaten one comes back. They come in pairs mirrored through the
 * centre of the arena, so both players always get the same offer.
 *
 * Who eats from a pellet is the simulation's business; this only keeps the
 * books. Shared by the CPU and the GPU simulation.
 */
export class NutrientPellets {
  public nutrients: Nutrient[] = [];
  private timers: number[] = [];

  public constructor(
    private readonly balance: GameBalance,
    private readonly random: () => number
  ) {}

  /**
   * Drops all pellets and spawns a fresh set. `isFree` tells a cell inside
   * the arena that no wall covers.
   */
  public reset(
    width: number,
    height: number,
    isFree: (x: number, y: number) => boolean
  ): void {
    this.nutrients = [];
    this.timers = [];
    if (width === 0 || height === 0) {
      return;
    }
    for (let i = 0; i < this.balance.nutrientCount; i++) {
      this.nutrients.push({ x: 0, y: 0, amount: 0 });
      this.timers.push(0);
    }
    for (let i = 0; i < this.nutrients.length; i += 2) {
      this.spawnPair(i, width, height, isFree);
    }
  }

  /**
   * Counts an eaten pellet's respawn delay down, and brings it back once it
   * is over. Respawning moves both halves of the pair, so it waits until the
   * partner is empty too - otherwise a pellet someone is still eating would
   * be yanked away and refilled. Returns the first pellet of the pair when
   * it respawned, null otherwise.
   */
  public tickEmpty(
    n: number,
    deltaTimeSec: number,
    width: number,
    height: number,
    isFree: (x: number, y: number) => boolean
  ): number | null {
    this.timers[n] -= deltaTimeSec;
    const partner = this.nutrients[n ^ 1];
    if (this.timers[n] > 0 || (partner != null && partner.amount > 0)) {
      return null;
    }
    const first = n - (n % 2);
    this.spawnPair(first, width, height, isFree);
    return first;
  }

  /**
   * Takes what `eaters` bacteria sucked out of a pellet. True when that ate
   * it up - its respawn delay starts then.
   */
  public drain(n: number, eaters: number, gain: number): boolean {
    const nutrient = this.nutrients[n];
    if (eaters <= 0 || nutrient.amount <= 0) {
      return false;
    }
    nutrient.amount -= eaters * gain;
    if (nutrient.amount > 0) {
      return false;
    }
    nutrient.amount = 0;
    this.timers[n] = this.balance.nutrientRespawnDelaySec;
    return true;
  }

  private spawnPair(
    first: number,
    width: number,
    height: number,
    isFree: (x: number, y: number) => boolean
  ): void {
    const { x, y } = this.findSpot(width, height, isFree);
    const amount = this.balance.nutrientEnergy;
    this.nutrients[first] = { x, y, amount };
    this.timers[first] = 0;

    const partner = first + 1;
    if (partner < this.nutrients.length) {
      this.nutrients[partner] = {
        x: width - 1 - x,
        y: height - 1 - y,
        amount,
      };
      this.timers[partner] = 0;
    }
  }

  /** A random spot that is inside the arena and not inside a wall. */
  private findSpot(
    width: number,
    height: number,
    isFree: (x: number, y: number) => boolean
  ): { x: number; y: number } {
    const margin = this.balance.nutrientRadius + 2;
    const spanX = Math.max(1, width - 2 * margin);
    const spanY = Math.max(1, height - 2 * margin);
    for (let attempt = 0; attempt < 40; attempt++) {
      const x = margin + Math.floor(this.random() * spanX);
      const y = margin + Math.floor(this.random() * spanY);
      // The walls are point symmetric, so a free spot has a free mirror image.
      if (isFree(x, y)) {
        return { x, y };
      }
    }
    return { x: margin, y: margin };
  }
}
