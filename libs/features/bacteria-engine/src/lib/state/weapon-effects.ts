import {
  ActiveEffect,
  EvolvedTraits,
  WEAPON_EFFECTS,
  weaponOf,
  WeaponId,
  WEAPONS,
} from './evolution';
import { countDown } from './fixed-tick';

/**
 * The weapons' effects a simulation holds: circles with an owner, which it
 * evaluates per bacterium (the CPU) or per cell (the GPU, from uniforms) -
 * see `evolution.ts`. Both simulations keep them here, so they agree on
 * when an effect acts and when it is gone.
 *
 * An effect acts from the step after it was added for as long as it lasts;
 * a strike (`durationSec` 0) acts in exactly one step. Once run out it is
 * still listed until the next step starts, so the painter gets to draw a
 * strike for a frame - and dropped then, so no consumer has to tell a
 * strike's first step from a later one.
 */
export class WeaponEffects {
  private readonly entries: EffectEntry[] = [];
  /** The effects of `entries`, listed anew only when one comes or goes. */
  private listed: readonly ActiveEffect[] = NONE;

  /** The effects as the painter draws them - run out ones included. */
  public get active(): readonly ActiveEffect[] {
    return this.listed;
  }

  /** Adds an effect - a copy of it, whose clock the steps run down. */
  public add(effect: ActiveEffect): void {
    this.entries.push({ effect: { ...effect }, stepped: false });
    this.relist();
  }

  /** Drops every effect - a new match starts. */
  public clear(): void {
    this.entries.length = 0;
    this.listed = NONE;
  }

  /**
   * Starts a step: drops the effects that ran out in the last one and
   * returns the ones acting in this one - none in a plain match, which is
   * what keeps that match playing as it did before there were weapons.
   */
  public begin(): readonly ActiveEffect[] {
    if (this.entries.length === 0) {
      return NONE;
    }
    let kept = 0;
    for (const entry of this.entries) {
      if (!isDone(entry)) {
        this.entries[kept++] = entry;
      }
    }
    if (kept < this.entries.length) {
      this.entries.length = kept;
      this.relist();
    }
    return this.listed;
  }

  /** Ends a step: the effects' clocks run on by its length. */
  public end(deltaTimeSec: number): void {
    for (const entry of this.entries) {
      entry.effect.remainingSec = countDown(
        entry.effect.remainingSec,
        deltaTimeSec
      );
      entry.stepped = true;
    }
  }

  private relist(): void {
    this.listed =
      this.entries.length === 0
        ? NONE
        : this.entries.map(({ effect }) => effect);
  }
}

interface EffectEntry {
  effect: ActiveEffect;
  /** True once it acted in a step. */
  stepped: boolean;
}

/** True once an effect ran out - listed until the next step starts. */
function isDone({ effect, stepped }: EffectEntry): boolean {
  return stepped && effect.remainingSec <= 0;
}

const NONE: readonly ActiveEffect[] = Object.freeze([]);

/** True when the effect's circle covers the cell. */
export function covers(effect: ActiveEffect, x: number, y: number): boolean {
  const dx = x - effect.x;
  const dy = y - effect.y;
  return dx * dx + dy * dy <= effect.radius * effect.radius;
}

/**
 * True when an effect acts on a colony: a hostile weapon's on every colony
 * but its owner's - a neutral colony too - any other on its owner's.
 */
export function actsOn(effect: ActiveEffect, playerId: number): boolean {
  return (effect.owner === playerId) !== weaponOf(effect.weapon).hostile;
}

/** True when any of the effects covers the cell. */
export function anyCovers(
  effects: readonly ActiveEffect[],
  x: number,
  y: number
): boolean {
  for (const effect of effects) {
    if (covers(effect, x, y)) {
      return true;
    }
  }
  return false;
}

/**
 * Times the pressure on a colony's bacteria: its membrane, and a weapon of
 * its own that reaches the whole colony - the biofilm shield - while one
 * lasts.
 */
export function toughnessOf(
  traits: EvolvedTraits,
  effects: readonly ActiveEffect[],
  playerId: number
): number {
  const toughness = traits.toughnessFactor ?? 1;
  // A plain loop: a step of a plain match allocates nothing here.
  for (let i = 0; i < effects.length; i++) {
    const effect = effects[i];
    if (
      weaponOf(effect.weapon).reach === 'colony' &&
      actsOn(effect, playerId)
    ) {
      return toughness * WEAPON_EFFECTS.shieldToughnessFactor;
    }
  }
  return toughness;
}

/** The number each weapon is known by in the shaders: its place in `WEAPONS`. */
export const WEAPON_CODE = Object.fromEntries(
  WEAPONS.map(({ id }, index) => [id, index])
) as Readonly<Record<WeaponId, number>>;
