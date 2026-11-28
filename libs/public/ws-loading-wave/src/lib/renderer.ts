import type { ShaderUniforms } from './webgl/loading-wave-shader';
import type { WaveGeometry } from './wave-model';

export type WaveRendererKind = 'webgl' | 'canvas';

/** a colour channel by channel, each 0 to 255 */
export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  /** the colour's own opacity, 0 to 1; 1 when unset */
  readonly alpha?: number;
}

/** the frame's grid opacity times the colour's own */
export function dotsOpacity(frame: WaveFrame, color: Rgb): number {
  return frame.dots * (color.alpha ?? 1);
}

/**
 * the dots' colours, the same in both renderers; their size follows the
 * host's and is part of the geometry
 */
export interface WaveLook {
  readonly color: Rgb;
  /** the colour lit dots and the wave take; the dots' colour when unset */
  readonly accent?: Rgb;
}

/** what one frame shows */
export interface WaveFrame {
  /** time since the wave started, drives where the front is */
  readonly elapsedMs: number;
  /** strength of the wave, 0 (no wave) to 1, for fading it in and out */
  readonly wave: number;
  /** opacity of the whole dot grid, 0 to 1, for fading it in and out */
  readonly dots: number;
}

/** opacity of a dot at rest, times the colour's */
export const REST_ALPHA = 0.22;
/** opacity of a dot right behind the front */
export const LIT_ALPHA = 0.9;
/** how much a dot right behind the front grows, 0.8 = 80% larger */
export const LIT_GROWTH = 0.8;
/** opacity of the hairline along the front */
export const FRONT_LINE_ALPHA = 0.14;

/** draws the dot grid and the wave into its own canvas */
export interface WaveRenderer {
  readonly kind: WaveRendererKind;
  readonly canvas: HTMLCanvasElement;
  /** sizes the canvas to the geometry at the given device pixel ratio */
  resize(geometry: WaveGeometry, pixelRatio: number): void;
  draw(frame: WaveFrame): void;
  /** changes the dots' look, say after the theme changed the host's colour */
  setLook(look: WaveLook): void;
  /** changes the values of a shader's own uniforms; only WebGL has any */
  setShaderUniforms(uniforms: ShaderUniforms | undefined): void;
  /** frees what the renderer holds; the canvas stays where it is */
  dispose(): void;
}

/** sets the canvas's backing store to the CSS size times the pixel ratio */
export function sizeCanvas(
  canvas: HTMLCanvasElement,
  geometry: WaveGeometry,
  pixelRatio: number
): void {
  canvas.width = Math.max(1, Math.round(geometry.width * pixelRatio));
  canvas.height = Math.max(1, Math.round(geometry.height * pixelRatio));
}
