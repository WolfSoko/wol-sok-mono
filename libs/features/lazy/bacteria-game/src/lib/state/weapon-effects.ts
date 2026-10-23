import {
  ActiveEffect,
  EvolvedTraits,
  WEAPON_EFFECTS,
  WeaponId,
} from './evolution';
import { countDown } from './fixed-tick';

/**
 * The weapons' effects a simulation holds: circles with an owner, which it
 * evaluates per bacterium (the CPU) or per cell (the GPU, from uniforms) -
 * see `evolution.ts`. Both simulations keep them here, so they agree on
 * when an effect acts and when it is gone.
 *
 * An effect acts from the step after it was added for as long as it lasts;
 * one that strikes at once (`durationSec` 0) acts in exactly one step. Once
 * run out it is still listed until the next step starts, so the painter
 * gets to draw a strike for a frame.
 */
export class WeaponEffects {
  private entries: EffectEntry[] = [];

  /** The effects as the painter draws them - run out ones included. */
  public get active(): readonly ActiveEffect[] {
    return this.entries.map(({ effect }) => effect);
  }

  public add(effect: ActiveEffect): void {
    this.entries.push({ effect, steps: 0, done: false });
  }

  /** Drops every effect - a new match starts. */
  public clear(): void {
    this.entries = [];
  }

  /**
   * Starts a step: drops the effects that ran out in the last one and
   * returns the ones acting in this one - none in a plain match, which is
   * what keeps that match playing as it did before there were weapons.
   */
  public begin(): readonly LiveEffect[] {
    if (this.entries.length === 0) {
      return NONE;
    }
    this.entries = this.entries.filter(({ done }) => !done);
    return this.entries.map(({ effect, steps }) => ({
      ...effect,
      fresh: steps === 0,
    }));
  }

  /** Ends a step: the effects' clocks run on by its length. */
  public end(deltaTimeSec: number): void {
    for (const entry of this.entries) {
      const remainingSec = countDown(entry.effect.remainingSec, deltaTimeSec);
      entry.steps++;
      entry.done = remainingSec <= 0;
      entry.effect = { ...entry.effect, remainingSec };
    }
  }
}

interface EffectEntry {
  effect: ActiveEffect;
  /** Steps it acted in so far. */
  steps: number;
  /** True once it ran out - listed until the next step starts. */
  done: boolean;
}

/** An effect acting in the step under way. */
export interface LiveEffect extends ActiveEffect {
  /** True in its first step - the one a strike acts in. */
  fresh: boolean;
}

const NONE: readonly LiveEffect[] = Object.freeze([]);

/** True when the effect's circle covers the cell. */
export function covers(effect: ActiveEffect, x: number, y: number): boolean {
  const dx = x - effect.x;
  const dy = y - effect.y;
  return dx * dx + dy * dy <= effect.radius * effect.radius;
}

/** True for an effect that acts on the enemies of its owner. */
export function isHostile(weapon: WeaponId): boolean {
  return (
    weapon === 'toxin-bomb' ||
    weapon === 'cryo-pulse' ||
    weapon === 'phage-strike'
  );
}

/**
 * The effects of one kind that act on a colony: an enemy's for the weapons
 * that hit enemies - every other seat counts as an enemy, a neutral colony
 * too - the colony's own for the others. A strike only in its first step.
 */
export function effectsOn(
  effects: readonly LiveEffect[],
  weapon: WeaponId,
  playerId: number
): LiveEffect[] {
  return effects.filter(
    (effect) =>
      effect.weapon === weapon &&
      (effect.weapon !== 'phage-strike' || effect.fresh) &&
      (effect.owner === playerId) !== isHostile(weapon)
  );
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
 * Times the pressure on a colony's bacteria: its membrane, and a biofilm
 * shield of its own while one lasts.
 */
export function toughnessOf(
  traits: EvolvedTraits,
  effects: readonly LiveEffect[],
  playerId: number
): number {
  const toughness = traits.toughnessFactor ?? 1;
  return effectsOn(effects, 'biofilm-shield', playerId).length > 0
    ? toughness * WEAPON_EFFECTS.shieldToughnessFactor
    : toughness;
}

/** The number each weapon is known by in the shaders. */
export const WEAPON_CODE: Readonly<Record<WeaponId, number>> = {
  'toxin-bomb': 0,
  'cryo-pulse': 1,
  'phage-strike': 2,
  'agar-bloom': 3,
  'biofilm-shield': 4,
};
