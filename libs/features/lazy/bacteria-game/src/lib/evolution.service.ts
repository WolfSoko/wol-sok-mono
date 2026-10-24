import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map, Subscription, switchMap, take, timer } from 'rxjs';
import { ProgressService } from './progress.service';
import {
  dnaEarned,
  GeneId,
  Loadout,
  weaponOf,
  WeaponId,
} from './state/evolution';
import {
  adoptEvolution,
  availableDna,
  canBuyAnySkin,
  canBuyAnything,
  canBuyGene,
  canBuySkin,
  canBuyWeapon,
  EMPTY_EVOLUTION,
  EvolutionProgress,
  levelOf,
  loadoutOf,
  mergeEvolution,
  nextGeneCost,
  ownsSkin,
  parseEvolution,
  resetEvolution,
  sameEvolution,
  withEquipped,
  withGeneLevel,
  withSkin,
  withWeapon,
} from './state/evolution-progress';
import { BacteriaLook } from './state/skins';
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
 * The skins (`state/skins.ts`) are bought with the same DNA and kept here
 * too; which one the colonies wear is the device's setting
 * (`GameSettingsService.look`), worn only once it is owned
 * ({@link wornSkin}).
 *
 * Like the progress it follows the player: on a sign-in or sign-out it
 * starts over from the next player's, and a guest who signs in to an account
 * brings what they bred along.
 */
/**
 * How long the new game's Start waits for the storage to tell what the
 * player evolved, in milliseconds. Offline with nothing cached it may never
 * tell: Start opens then, and the match plays what is known.
 */
export const EVOLUTION_WAIT_MS = 3000;

@Injectable({ providedIn: 'root' })
export class EvolutionService {
  private readonly storage = inject(GameStorage);
  private readonly account = inject(GameAccount);
  private readonly device = inject(DeviceStorage);
  private readonly progress = inject(ProgressService);
  private readonly state = signal(EMPTY_EVOLUTION);
  /** True once the storage has answered for the evolution. */
  private readonly answered = signal(false);
  /**
   * True while the device's pick of a skin is trusted without the storage:
   * until it answers for the first time, or another player takes over.
   */
  private readonly trustsPick = signal(true);
  /** True once {@link EVOLUTION_WAIT_MS} passed since the player was known. */
  private readonly waitedOut = signal(false);
  private waiting: Subscription | null = null;

  public constructor() {
    inject(DestroyRef).onDestroy(() => this.waiting?.unsubscribe());
    this.waitForStorage();
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
        this.trustsPick.set(false);
      });
  }

  /** True once both the evolution and the progress are known. */
  public readonly loaded = computed(
    () => this.answered() && this.progress.loaded()
  );

  /**
   * True once a match can start with what the player evolved: the storage
   * has told it, or kept silent for {@link EVOLUTION_WAIT_MS}. The new
   * game's Start waits for it, so a match started right after the app
   * opened or a sign-in does not play plain only because the storage
   * answered late - and the match itself never waits on storage.
   */
  public readonly settled = computed(() => this.loaded() || this.waitedOut());

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

  /** The DNA left while it buys a skin, 0 otherwise - the My Colony tile's badge. */
  public readonly skinDna = computed(() =>
    this.loaded() && canBuyAnySkin(this.earned(), this.state()) ? this.dna() : 0
  );

  public level(gene: GeneId): number {
    return levelOf(this.state(), gene);
  }

  /** The cost of a gene's next level, null once it is at the top. */
  public geneCost(gene: GeneId): number | null {
    return nextGeneCost(this.state(), gene);
  }

  public weaponCost(weapon: WeaponId): number {
    return weaponOf(weapon).cost;
  }

  public owns(weapon: WeaponId): boolean {
    return this.state().weapons.includes(weapon);
  }

  /** True for a skin the player may wear: free, or bought. */
  public ownsSkin(skin: BacteriaLook): boolean {
    return ownsSkin(this.state(), skin);
  }

  /**
   * The skin the colonies wear for the look picked: that look, as long as
   * the player owns it - the slime otherwise. Until the storage has
   * answered for the first time, the pick is trusted: it was made on this
   * device, most likely by the player who owns it, and the dish must not
   * flicker to the slime on every start. After another player takes over
   * it is not: their storage says what they own. Reads signals, so a
   * `computed` over it follows along.
   */
  public wornSkin(look: BacteriaLook): BacteriaLook {
    return this.trustsPick() || ownsSkin(this.state(), look) ? look : 'slime';
  }

  public canBuySkin(skin: BacteriaLook): boolean {
    return this.loaded() && canBuySkin(this.earned(), this.state(), skin);
  }

  /** Buys a skin, if the DNA left pays for it. Returns whether it did. */
  public buySkin(skin: BacteriaLook): boolean {
    if (!this.canBuySkin(skin)) {
      return false;
    }
    this.apply((evolution) => withSkin(evolution, skin));
    return true;
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

  /** Gives every strand back: no gene, no weapon. Free. The skins stay. */
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

  /** Gives the storage {@link EVOLUTION_WAIT_MS} to tell, from now on. */
  private waitForStorage(): void {
    this.waiting?.unsubscribe();
    this.waitedOut.set(false);
    this.waiting = timer(EVOLUTION_WAIT_MS).subscribe(() =>
      this.waitedOut.set(true)
    );
  }

  /**
   * Starts over for the next player - unless a guest signed in to an account
   * that has played elsewhere: then what the guest bred joins it, once.
   */
  private switchTo({ adoptsGuest }: PlayerSwitch): void {
    const guest = this.state();
    this.answered.set(false);
    this.trustsPick.set(false);
    this.waitForStorage();
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
