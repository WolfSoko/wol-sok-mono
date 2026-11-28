/*
 * Public API Surface of @wolsok/loading-wave
 */
export { LoadingWaveDirective } from './lib/loading-wave.directive';
export { LoadingWaveSpinnerComponent } from './lib/loading-wave-spinner.component';
export {
  DEFAULT_LOADING_WAVE_OPTIONS,
  LOADING_WAVE_OPTIONS,
  provideLoadingWave,
} from './lib/loading-wave-options';
export type { Autoscale, WaveOrigin } from './lib/wave-model';
export type {
  AfterLoading,
  LoadingWaveOptions,
  ResolvedLoadingWaveOptions,
  WaveRendererPreference,
} from './lib/loading-wave-options';
export type { WaveRendererKind } from './lib/renderer';
export type {
  LoadingWaveShader,
  ShaderUniforms,
  ShaderUniformValue,
} from './lib/webgl/loading-wave-shader';
export { rippleShader } from './lib/webgl/shaders/ripple.shader';
