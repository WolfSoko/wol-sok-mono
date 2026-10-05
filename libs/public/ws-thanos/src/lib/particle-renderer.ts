import { AnimationState } from './animation.state';
import { WsThanosCrumble } from './ws-thanos.options';

/** moves and draws the particles of one vaporizing element */
export interface ParticleRenderer {
  /** the effect canvas, positioned by the caller */
  readonly canvas: HTMLCanvasElement;
  /** how this renderer breaks the element apart */
  readonly crumble: WsThanosCrumble;
  /** advance the simulation by one frame and draw it */
  render(animationState: AnimationState): void;
  /** free all resources, the canvas is not usable afterwards */
  dispose(): void;
}

export interface ParticleRendererParams {
  /** effect canvas size in device pixels */
  width: number;
  height: number;
  particleAcceleration: number;
  /** device pixels per css pixel */
  pixelScale: number;
  crumble: WsThanosCrumble;
  /** random seed that makes every snap look different */
  seed: number;
}
