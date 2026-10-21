import { Nutrient } from './bacteria-simulation';
import { soleLeader } from './win-conditions';
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
  /**
   * Bumped per pellet whenever it is placed anew - counts of who eats from
   * it taken before then are about another spot.
   */
  public readonly generations: number[] = [];
  private timers: number[] = [];
  /** What each colony took of each pellet since it was placed, by slot. */
  private bites: number[][] = [];
  private width = 0;
  private height = 0;
  private isFree: (x: number, y: number) => boolean = () => true;

  public constructor(
    private readonly balance: GameBalance,
    private readonly random: () => number
  ) {}

  /**
   * Drops all pellets and spawns a fresh set in an arena of this size.
   * `isFree` tells a cell inside it that no wall covers; it is asked again
   * whenever a pellet respawns.
   */
  public reset(
    width: number,
    height: number,
    isFree: (x: number, y: number) => boolean
  ): void {
    this.width = width;
    this.height = height;
    this.isFree = isFree;
    this.nutrients = [];
    this.timers = [];
    this.bites = [];
    if (width === 0 || height === 0) {
      return;
    }
    for (let i = 0; i < this.balance.nutrientCount; i++) {
      this.nutrients.push({ x: 0, y: 0, amount: 0 });
      this.timers.push(0);
      this.generations[i] ??= 0;
    }
    for (let i = 0; i < this.nutrients.length; i += 2) {
      this.spawnPair(i);
    }
  }

  /**
   * Counts an eaten pellet's respawn delay down, and brings it back once it
   * is over. Respawning moves both halves of the pair, so it waits until the
   * partner is empty too - otherwise a pellet someone is still eating would
   * be yanked away and refilled.
   */
  public tickEmpty(n: number, deltaTimeSec: number): void {
    this.timers[n] -= deltaTimeSec;
    const partner = this.nutrients[n ^ 1];
    if (this.timers[n] <= 0 && (partner == null || partner.amount <= 0)) {
      this.spawnPair(n - (n % 2));
    }
  }

  /**
   * Takes what the bacteria within reach sucked out of a pellet - `eaters`
   * holds how many of them each colony has, by slot. Null while the pellet
   * lasts; once this ate it up - its respawn delay starts then - who ate it:
   * the slot of the colony that took the most of it all along, null when
   * two took as much.
   */
  public drain(
    n: number,
    eaters: ArrayLike<number>,
    gain: number
  ): { by: number | null } | null {
    const nutrient = this.nutrients[n];
    let total = 0;
    for (let slot = 0; slot < eaters.length; slot++) {
      total += eaters[slot];
    }
    if (total <= 0 || nutrient.amount <= 0) {
      return null;
    }
    const bites = (this.bites[n] ??= []);
    for (let slot = 0; slot < eaters.length; slot++) {
      bites[slot] = (bites[slot] ?? 0) + eaters[slot] * gain;
    }
    nutrient.amount -= total * gain;
    if (nutrient.amount > 0) {
      return null;
    }
    nutrient.amount = 0;
    this.timers[n] = this.balance.nutrientRespawnDelaySec;
    // The slot that took the most - nobody when two took as much.
    return {
      by: soleLeader(
        bites.map((_, slot) => slot),
        (slot) => bites[slot]
      ),
    };
  }

  private spawnPair(first: number): void {
    const { width, height } = this;
    const { x, y } = this.findSpot();
    const amount = this.balance.nutrientEnergy;
    this.place(first, { x, y, amount });

    const partner = first + 1;
    if (partner < this.nutrients.length) {
      this.place(partner, { x: width - 1 - x, y: height - 1 - y, amount });
    }
  }

  private place(n: number, nutrient: Nutrient): void {
    this.nutrients[n] = nutrient;
    this.timers[n] = 0;
    this.bites[n] = [];
    this.generations[n]++;
  }

  /** A random spot that is inside the arena and not inside a wall. */
  private findSpot(): { x: number; y: number } {
    const { width, height, isFree } = this;
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
