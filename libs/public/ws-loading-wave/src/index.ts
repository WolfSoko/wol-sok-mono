/*
 * Public API Surface of @wolsok/loading-wave
 */
export { LoadingWaveDirective } from './lib/loading-wave.directive';
export {
  DEFAULT_LOADING_WAVE_OPTIONS,
  LOADING_WAVE_OPTIONS,
  provideLoadingWave,
} from './lib/loading-wave-options';
export type {
  AfterLoading,
  LoadingWaveOptions,
  WaveRendererPreference,
} from './lib/loading-wave-options';
export type { WaveRendererKind } from './lib/renderer';
export type {
  LoadingWaveShader,
  ShaderUniforms,
  ShaderUniformValue,
} from './lib/webgl/loading-wave-shader';
export { rippleShader } from './lib/webgl/shaders/ripple.shader';
