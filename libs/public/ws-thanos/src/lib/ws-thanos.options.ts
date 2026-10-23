/**
 * How the element breaks apart (needs WebGL2, the canvas fallback always uses 'dust'):
 * - dust: particles blow away along the vaporizing front
 * - cracks: cracks spread through the element before it turns to dust
 * - shards: cracks split the element into shards that shift and tilt before they turn to dust
 * - chunks: whole chunks break off, jump away and then crumble to dust
 */
export type WsThanosCrumble = 'dust' | 'cracks' | 'shards' | 'chunks';

export interface WsThanosOptions {
  animationLength: number;
  maxParticleCount: number;
  /**
   * the most device pixels per css pixel the element is captured and drawn with:
   * lower it to snap big elements with fewer pixels, below 1 the particles get coarser
   */
  maxPixelRatio: number;
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
