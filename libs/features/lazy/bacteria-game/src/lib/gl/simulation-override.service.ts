import { inject, Injectable, signal } from '@angular/core';
import { take } from 'rxjs';
import { isRuleset, Ruleset } from '../state/simulation';
import { DeviceStorage } from '../storage/game-storage';

/** Where this device keeps its simulation override. */
export const SIMULATION_OVERRIDE_STORAGE_KEY = 'bacteria-game.sim-override';

/** The URL query that sets the override: `?sim=gpu-int`, `?sim=cpu`, `?sim=auto`. */
export const SIMULATION_OVERRIDE_PARAM = 'sim';

/** A stored override, as far as it can be read - null for none. */
export function parseSimulationOverride(value: unknown): Ruleset | null {
  return isRuleset(value) ? value : null;
}

/** Takes `?sim=` out of the page's address, everything else as it was. */
function dropOverrideQuery(): void {
  if (typeof location === 'undefined' || typeof history === 'undefined') {
    return;
  }
  const url = new URL(location.href);
  if (!url.searchParams.has(SIMULATION_OVERRIDE_PARAM)) {
    return;
  }
  url.searchParams.delete(SIMULATION_OVERRIDE_PARAM);
  history.replaceState(history.state, '', url);
}

/**
 * What a URL query asks of the override: a ruleset, `auto` (null) to clear
 * it, or undefined when it says nothing about it.
 */
export function overrideFromQuery(search: string): Ruleset | null | undefined {
  const value = new URLSearchParams(search).get(SIMULATION_OVERRIDE_PARAM);
  if (value === 'auto') {
    return null;
  }
  return isRuleset(value) ? value : undefined;
}

/**
 * The device's choice of simulation (ADR 0015, step 8), in the settings
 * ("Simulation": Auto, GPU, CPU) or the URL: `?sim=gpu-int` plays local
 * matches on the integer GPU passes whatever the self-test said,
 * `?sim=cpu` on the CPU's ruleset, and `?sim=auto` goes back to the
 * self-test's choice. It stays with the device (`DeviceStorage`) until
 * changed, and never changes what the device offers in an online match.
 */
@Injectable({ providedIn: 'root' })
export class SimulationOverrideService {
  private readonly storage = inject(DeviceStorage);
  private readonly forced = signal<Ruleset | null>(null);
  private started = false;
  /** True once the player chose: a late stored value must not undo it. */
  private chosen = false;

  /** The ruleset local matches are forced to - null to follow the self-test. */
  public readonly override = this.forced.asReadonly();

  /**
   * Reads the stored override, and takes the one the URL asks for instead,
   * once per page session. The argument is for specs.
   */
  public start(
    search: string = typeof location === 'undefined' ? '' : location.search
  ): void {
    if (this.started) {
      return;
    }
    this.started = true;
    const asked = overrideFromQuery(search);
    if (asked !== undefined) {
      this.forced.set(asked);
      this.storage.write(SIMULATION_OVERRIDE_STORAGE_KEY, asked);
      return;
    }
    this.storage
      .watch(SIMULATION_OVERRIDE_STORAGE_KEY)
      .pipe(take(1))
      .subscribe((value) => {
        if (!this.chosen) {
          this.forced.set(parseSimulationOverride(value));
        }
      });
  }

  /**
   * The player's choice in the settings: a ruleset, or null for Auto. It
   * takes `?sim=` out of the address, or a reload would undo it.
   */
  public choose(ruleset: Ruleset | null): void {
    this.chosen = true;
    this.forced.set(ruleset);
    this.storage.write(SIMULATION_OVERRIDE_STORAGE_KEY, ruleset);
    dropOverrideQuery();
  }
}
