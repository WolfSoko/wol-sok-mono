import { computed, inject, Injectable, signal } from '@angular/core';
import {
  FEATURE_TOGGLES,
  featureToggles,
  type FeatureToggles,
  type FeatureToggleStates,
  resolveToggles,
} from '@wolsok/feat-shared-bacteria-engine/cloud';
import { GameAccount } from './storage/game-account';
import { GameToggles } from './storage/game-toggles';

/**
 * The owner's feature toggles as the game reads them (ADR 0012): the
 * defaults (`FEATURE_TOGGLES`) at first, what Remote Config says once
 * `start` asked it and it answered. A toggle is a switch for what players
 * see, not a lock - the functions do not read them.
 *
 * Each toggle has a state (#3194): `off`, `admin` or `on`. `toggles`
 * resolves them for whoever plays: `admin` is on while the owner plays
 * (`GameAccount.owner`), so it follows a sign-in or sign-out at once.
 *
 * A feature that must not change in the middle of something reads its
 * toggle once, as it starts: a match keeps the simulation it began with.
 */
@Injectable({ providedIn: 'root' })
export class FeatureTogglesService {
  private readonly source = inject(GameToggles);
  private readonly owner = inject(GameAccount).owner;
  private readonly state = signal<FeatureToggleStates>(FEATURE_TOGGLES);
  private started = false;

  /** Every toggle's state, set or defaulted. */
  public readonly states = this.state.asReadonly();

  /** Every toggle, on or off for whoever plays now. */
  public readonly toggles = computed((): FeatureToggles =>
    resolveToggles(this.state(), this.owner())
  );

  /**
   * Starts reading the toggles - once, whoever calls. The game calls it
   * after its first render, so Remote Config's SDK and fetch stay off the
   * start; the defaults cover the gap. The port never errors.
   */
  public start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    // Root-provided like the port, so the subscription lasts the visit.
    this.source
      .watch()
      .subscribe((set) => this.state.set(featureToggles((key) => set[key])));
  }
}
