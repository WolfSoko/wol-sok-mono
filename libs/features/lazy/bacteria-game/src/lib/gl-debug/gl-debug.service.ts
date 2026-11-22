import { computed, effect, inject, Injectable, untracked } from '@angular/core';
import { dropQueryParam } from '../drop-query-param';
import { GameSettingsService } from '../settings.service';
import { GameAccount } from '../storage/game-account';

/** The URL query that turns the GL diagnostic on: `?gldebug`. */
export const GL_DEBUG_PARAM = 'gldebug';

/**
 * The GL diagnostic (#3174), for a device whose arena draws wrong: the HUD
 * shows the frame breakdown, the WebGL renderer and the GL errors of each
 * pass, and a button that saves the painter's layers as a picture. Every
 * pass is then checked for errors, which slows the GPU down. Nothing of it
 * is sent anywhere.
 *
 * It runs for this page's session with `?gldebug` in the address (the
 * query leaves it), and while the owner plays with the switch in the
 * settings on - for the Android app, where no query can be typed. Signing
 * out switches it off.
 */
@Injectable({ providedIn: 'root' })
export class GlDebugService {
  private readonly account = inject(GameAccount);
  private readonly settings = inject(GameSettingsService);
  /** Read off the address as the service is made - before any painter is. */
  private readonly fromAddress = takeQueryFlag(GL_DEBUG_PARAM);

  /** True where the settings offer the switch: while the owner plays. */
  public readonly canSwitch = computed(() => this.account.owner());

  /** True while the diagnostic runs. */
  public readonly on = computed(
    () =>
      this.fromAddress ||
      (this.account.owner() && this.settings.value('glDebug'))
  );

  public constructor() {
    let wasOwner = false;
    effect(() => {
      const owner = this.account.owner();
      if (wasOwner && !owner) {
        untracked(() => this.settings.set('glDebug', false));
      }
      wasOwner = owner;
    });
  }
}

/** True when the page's address has the flag, which leaves it. */
function takeQueryFlag(name: string): boolean {
  if (typeof location === 'undefined') {
    return false;
  }
  const present = new URLSearchParams(location.search).has(name);
  if (present) {
    dropQueryParam(name);
  }
  return present;
}
