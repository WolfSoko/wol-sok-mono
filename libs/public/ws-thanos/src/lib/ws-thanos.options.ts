/**
 * How the element breaks apart (needs WebGL2, the canvas fallback always uses 'dust'):
 * - dust: particles blow away along the vaporizing front
 * - cracks: cracks spread through the element before it turns to dust
 * - shards: cracks split the element into shards that shift and tilt before they turn to dust
 * - chunks: whole chunks break off, fall and then crumble to dust
 */
export type WsThanosCrumble = 'dust' | 'cracks' | 'shards' | 'chunks';

export interface WsThanosOptions {
  animationLength: number;
  maxParticleCount: number;
  particleAcceleration: number;
  /** play a windy, sandy sound while vaporizing */
  sound: boolean;
  /** volume of the snap sound between 0 and 1 */
  soundVolume: number;
  /** how the element breaks apart */
  crumble: WsThanosCrumble;
}
