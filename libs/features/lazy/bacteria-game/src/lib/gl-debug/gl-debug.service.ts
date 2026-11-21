import { Injectable, signal } from '@angular/core';
import { dropQueryParam } from '../gpu-choice/drop-query-param';

/** The URL query that turns the GL diagnostic on: `?gldebug`. */
export const GL_DEBUG_PARAM = 'gldebug';

/**
 * The GL diagnostic (#3174), for a device whose arena draws wrong: with
 * `?gldebug` in the address, the HUD shows the frame breakdown, the WebGL
 * renderer and the GL errors of each pass, and a button that saves the
 * painter's layers as a picture. For this page's session only: nothing is
 * stored, nothing sent anywhere, and the query leaves the address. Every
 * pass is then checked for errors, which slows the GPU down.
 */
@Injectable({ providedIn: 'root' })
export class GlDebugService {
  private readonly enabled = signal(false);

  /** True while the diagnostic runs. */
  public readonly on = this.enabled.asReadonly();

  /** Takes `?gldebug` off the address, and turns the diagnostic on if it was there. */
  public start(): void {
    if (typeof location === 'undefined') {
      return;
    }
    if (!new URLSearchParams(location.search).has(GL_DEBUG_PARAM)) {
      return;
    }
    this.enabled.set(true);
    dropQueryParam(GL_DEBUG_PARAM);
  }
}
