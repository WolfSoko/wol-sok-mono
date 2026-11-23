/**
 * The arena rendering and the GPU simulation of Bacteria Wars (#3102): the
 * painters, the WebGL arena, the GPU passes and their self-test. Depends on
 * the engine only; the game takes everything through this index.
 */
export { AdaptiveQuality } from './lib/arena/adaptive-quality';
export { DishAmbience } from './lib/arena/ambience';
export { arenaContent, SeatColors } from './lib/arena/arena-content';
export {
  type ArenaFrame,
  type ArenaLayout,
  type ArenaPainter,
  type CapturedLayer,
  layoutKey,
  type PainterDiagnostics,
} from './lib/arena/arena-painter';
export {
  arenaTheme,
  type ArenaTheme,
  cssTriple,
  type Rgb,
  WEAPON_COLORS,
} from './lib/arena/arena-theme';
export {
  ARENA_PAINTER_FACTORY,
  type ArenaContent,
  type ArenaScene,
  ArenaViewComponent,
} from './lib/arena/arena-view.component';
export { Camera, CameraShake } from './lib/arena/camera';
export { mix, putPixels, rgba } from './lib/arena/canvas-math';
export { FramePerf, type FramePerfReport } from './lib/arena/frame-perf';
export { GlArenaPainter } from './lib/arena/gl/gl-arena-painter';
export {
  floorPixels,
  grainPixels,
  levelPreviewScene,
  paintLevelPreview,
  PREVIEW_HEIGHT,
  PREVIEW_WIDTH,
  zonePixels,
} from './lib/arena/level-preview';
export { HERO_PREVIEW } from './lib/arena/look-preview';
export { LookPreviewComponent } from './lib/arena/look-preview.component';
export { MinimapPainter } from './lib/arena/minimap';
export { ZONE_COLORS } from './lib/arena/zone-look';
export { type GpuSelfTestResult, runGpuSelfTest } from './lib/gl/gpu-self-test';
export { type GpuSimulationOptions } from './lib/gl/gpu-simulation';
export { type GlErrorCount } from './lib/gl/gl-diagnostics';
export { createProgram, type Program } from './lib/gl/gl-utils';
export { GpuTimer } from './lib/gl/gpu-timer';
export { isSoftwareRenderer, rendererOf } from './lib/gl/renderer';
export {
  chooseSimulation,
  type DeviceSimulations,
  gpuSimulationsOf,
} from './lib/gl/simulation-choice';
export {
  GPU_SELF_TEST_STORAGE_KEY,
  keepsSelfTest,
  parseStoredSelfTest,
  SELF_TEST_MAX_AGE_MS,
  type SelfTestDevice,
  storedResultHolds,
  type StoredSelfTest,
  storedSelfTestOf,
  thisDevice,
  verdictOf,
  whenIdle,
} from './lib/gl/stored-self-test';
export { cssColor } from './lib/player-color';
export { prefersReducedMotion, reducedMotionNow } from './lib/reduced-motion';
