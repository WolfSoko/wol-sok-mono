/**
 * How the element breaks apart (needs WebGL2, the canvas fallback always uses 'dust'):
 * - dust: particles blow away along the vaporizing front
 * - cracks: cracks spread through the element before it turns to dust
 * - shards: cracks split the element into shards that shift and tilt before they turn to dust
 * - chunks: whole chunks break off, jump away and then crumble to dust
 */
export const WS_THANOS_CRUMBLES = [
  'dust',
  'cracks',
  'shards',
  'chunks',
] as const;

/** one of {@link WS_THANOS_CRUMBLES} */
export type WsThanosCrumble = (typeof WS_THANOS_CRUMBLES)[number];

export interface WsThanosOptions {
  animationLength: number;
  maxParticleCount: number;
  /**
   * the most pixels the element is captured with, every one a particle:
   * a big element is captured at a lower pixel ratio, below css pixels if needed.
   * Unlike maxParticleCount, which leaves out random pixels, the particles get coarser.
   * No limit when unset.
   */
  maxCapturePixels?: number;
  particleAcceleration: number;
  /** play a windy, sandy sound while vaporizing */
  sound: boolean;
  /** volume of the snap sound between 0 and 1 */
  soundVolume: number;
  /** how the element breaks apart */
  crumble: WsThanosCrumble;
  /** warm up the effect while the browser is idle, so the first snap does not stutter */
  preload: boolean;
}
