import { Injectable, signal } from '@angular/core';
import { dropQueryParam } from '../drop-query-param';

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
  /**
   * True while the diagnostic runs: read off the address as the service
   * is made - before any painter is - and the query taken out of it.
   */
  public readonly on = signal(takeQueryFlag(GL_DEBUG_PARAM)).asReadonly();
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
