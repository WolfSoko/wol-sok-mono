import { computed, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map, switchMap, take } from 'rxjs';
import { ProgressService } from './progress.service';
import { dnaEarned, GeneId, Loadout, WeaponId } from './state/evolution';
import {
  adoptEvolution,
  availableDna,
  canBuyAnything,
  canBuyGene,
  canBuyWeapon,
  EMPTY_EVOLUTION,
  EvolutionProgress,
  levelOf,
  loadoutOf,
  mergeEvolution,
  nextGeneCost,
  parseEvolution,
  resetEvolution,
  sameEvolution,
  WEAPON_COSTS,
  withEquipped,
  withGeneLevel,
  withWeapon,
} from './state/evolution-progress';
import { GameAccount, PlayerSwitch } from './storage/game-account';
import { DeviceStorage, GameStorage } from './storage/game-storage';

export const EVOLUTION_STORAGE_KEY = 'bacteria-game.evolution';

/**
 * What the player has bred into their colony - the genes, the weapons bought
 * and the one carried - and the DNA left to spend on more (ADR 0013).
 *
 * Kept in the game storage under a key of its own. Every change goes
 * through `update`, applied to the stored value merged with the one here:
 * purchases only gain, so a purchase on another device is never undone; a
 * reset raises the epoch and wins over the purchases it gave back.
 *
 * Nothing can be bought before both this and the progress have been told by
 * the storage - the DNA left is not known before.
 *
 * Like the progress it follows the player: on a sign-in or sign-out it
 * starts over from the next player's, and a guest who signs in to an account
 * brings what they bred along.
 */
@Injectable({ providedIn: 'root' })
export class EvolutionService {
  private readonly storage = inject(GameStorage);
  private readonly account = inject(GameAccount);
  private readonly device = inject(DeviceStorage);
  private readonly progress = inject(ProgressService);
  private readonly state = signal(EMPTY_EVOLUTION);
  /** True once the storage has answered for the evolution. */
  private readonly answered = signal(false);

  public constructor() {
    this.account.players
      .pipe(
        switchMap((player, index) => {
          if (index > 0) {
            this.switchTo(player);
          } else if (this.account.cloud) {
            this.moveDeviceEvolution();
          }
          return this.storage.watch(EVOLUTION_STORAGE_KEY);
        }),
        map(parseEvolution),
        takeUntilDestroyed()
      )
      .subscribe((stored) => {
        const merged = mergeEvolution(this.state(), stored);
        if (!sameEvolution(merged, this.state())) {
          this.state.set(merged);
        }
        this.answered.set(true);
      });
  }

  /** True once both the evolution and the progress are known. */
  public readonly loaded = computed(
    () => this.answered() && this.progress.loaded()
  );

  /** Everything held. */
  public readonly evolution = this.state.asReadonly();

  /** The DNA all the XP so far has earned, spent or not. */
  public readonly earned = computed(() => dnaEarned(this.progress.xp()));

  /** The DNA left to spend - 0 after a merge that spent more. */
  public readonly dna = computed(() =>
    availableDna(this.earned(), this.state())
  );

  /** True when the DNA left buys something - the menu's badge. */
  public readonly canEvolve = computed(
    () => this.loaded() && canBuyAnything(this.earned(), this.state())
  );

  /** What the player takes into a match against the computer. */
  public readonly loadout = computed((): Loadout => loadoutOf(this.state()));

  /** The weapon carried into the next match, null for none. */
  public readonly equipped = computed(() => this.state().equipped);

  public level(gene: GeneId): number {
    return levelOf(this.state(), gene);
  }

  /** The cost of a gene's next level, null once it is at the top. */
  public geneCost(gene: GeneId): number | null {
    return nextGeneCost(this.state(), gene);
  }

  public weaponCost(weapon: WeaponId): number {
    return WEAPON_COSTS[weapon];
  }

  public owns(weapon: WeaponId): boolean {
    return this.state().weapons.includes(weapon);
  }

  public canBuyGene(gene: GeneId): boolean {
    return this.loaded() && canBuyGene(this.earned(), this.state(), gene);
  }

  public canBuyWeapon(weapon: WeaponId): boolean {
    return this.loaded() && canBuyWeapon(this.earned(), this.state(), weapon);
  }

  /** Breeds a gene one level up, if the DNA left pays for it. Returns whether it did. */
  public buyGene(gene: GeneId): boolean {
    if (!this.canBuyGene(gene)) {
      return false;
    }
    const level = this.level(gene) + 1;
    this.apply((evolution) => withGeneLevel(evolution, gene, level));
    return true;
  }

  /** Buys a weapon, if the DNA left pays for it. Returns whether it did. */
  public buyWeapon(weapon: WeaponId): boolean {
    if (!this.canBuyWeapon(weapon)) {
      return false;
    }
    this.apply((evolution) => withWeapon(evolution, weapon));
    return true;
  }

  /** Carries a weapon held into the next match - or none, for null. */
  public equip(weapon: WeaponId | null): void {
    if (weapon === this.equipped() || (weapon !== null && !this.owns(weapon))) {
      return;
    }
    this.apply((evolution) => withEquipped(evolution, weapon));
  }

  /** Gives every strand back: no gene, no weapon. Free. */
  public reset(): void {
    const held = this.state();
    this.state.set(resetEvolution(held));
    this.storage.update(EVOLUTION_STORAGE_KEY, (stored) =>
      resetEvolution(held, parseEvolution(stored))
    );
  }

  /**
   * Applies a change here and to the stored value, merged with what is
   * held here - so a purchase made before the storage answered is kept,
   * and one made elsewhere is not lost.
   */
  private apply(
    change: (evolution: EvolutionProgress) => EvolutionProgress
  ): void {
    const held = this.state();
    this.state.set(change(held));
    this.storage.update(EVOLUTION_STORAGE_KEY, (stored) =>
      change(mergeEvolution(parseEvolution(stored), held))
    );
  }

  /**
   * Starts over for the next player - unless a guest signed in to an account
   * that has played elsewhere: then what the guest bred joins it, once.
   */
  private switchTo({ adoptsGuest }: PlayerSwitch): void {
    const guest = this.state();
    this.answered.set(false);
    this.state.set(EMPTY_EVOLUTION);
    if (adoptsGuest) {
      this.adopt(guest);
    }
  }

  /** Hands what this device bred before the cloud to the first player, once. */
  private moveDeviceEvolution(): void {
    this.device
      .watch(EVOLUTION_STORAGE_KEY)
      .pipe(take(1))
      .subscribe((stored) => {
        if (stored === null) {
          return;
        }
        this.adopt(parseEvolution(stored));
        this.device.write(EVOLUTION_STORAGE_KEY, null);
      });
  }

  private adopt(guest: EvolutionProgress): void {
    if (sameEvolution(guest, EMPTY_EVOLUTION)) {
      return;
    }
    this.storage.update(EVOLUTION_STORAGE_KEY, (stored) =>
      adoptEvolution(parseEvolution(stored), guest)
    );
  }
}
