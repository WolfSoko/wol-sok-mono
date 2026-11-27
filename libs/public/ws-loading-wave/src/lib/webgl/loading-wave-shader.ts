/** a uniform's value: a `float`, or the components of a `vec2` to `vec4` */
export type ShaderUniformValue =
  | number
  | readonly [number]
  | readonly [number, number]
  | readonly [number, number, number]
  | readonly [number, number, number, number];

/** values of the uniforms a fragment declares itself, by their GLSL name */
export type ShaderUniforms = Readonly<Record<string, ShaderUniformValue>>;

/**
 * A fragment shader for the loading wave's WebGL renderer.
 *
 * `fragment` is GLSL ES 3.00 that defines `vec4 wsShade(vec2 point)`: the
 * straight (not premultiplied) colour and opacity at `point`, in CSS pixels
 * from the host's top left corner. The lib puts the `ws_*` uniforms and
 * helpers before it and a `main` after it (see the README), so the fragment
 * holds neither `#version` nor `main`. At `ws_wave == 0` it draws its resting
 * state, without `ws_time`: that is what `afterLoading: 'keep'` leaves and
 * what `prefers-reduced-motion` shows.
 */
export interface LoadingWaveShader {
  readonly fragment: string;
  /** values of uniforms the fragment declares itself; never `ws_*` ones */
  readonly uniforms?: ShaderUniforms;
}
