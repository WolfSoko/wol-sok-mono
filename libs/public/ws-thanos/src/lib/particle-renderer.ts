import { AnimationState } from './animation.state';

/** moves and draws the particles of one vaporizing element */
export interface ParticleRenderer {
  /** the effect canvas, positioned by the caller */
  readonly canvas: HTMLCanvasElement;
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
  /** random seed that makes every snap look different */
  seed: number;
}
