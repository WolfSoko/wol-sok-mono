import {
  ColorMode,
  ComplexPoint,
  FractalView,
  HOME_VIEW,
} from './fractal-view';

export interface FractalPreset {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly view: FractalView;
  /** 0 renders the Mandelbrot set, 1 the Julia set of `juliaC`. */
  readonly morph?: number;
  readonly juliaC?: ComplexPoint;
  readonly colorMode?: ColorMode;
  readonly palette?: number;
  readonly density?: number;
}

/**
 * Landmarks of the Mandelbrot set plus a few classic Julia constants. The deep
 * ones are what the emulated double precision path was built for.
 */
export const FRACTAL_PRESETS: readonly FractalPreset[] = [
  {
    id: 'home',
    label: 'Home',
    hint: 'The whole set',
    view: HOME_VIEW,
    morph: 0,
    colorMode: 'smooth',
    palette: 2,
    density: 1.8,
  },
  {
    id: 'seahorse-valley',
    label: 'Seahorse Valley',
    hint: 'Seahorse tails between the head and the body',
    view: { centerX: -0.7453, centerY: 0.1127, scale: 6.5e-4 },
    morph: 0,
    colorMode: 'smooth',
    palette: 2,
    density: 1.8,
  },
  {
    id: 'elephant-valley',
    label: 'Elephant Valley',
    hint: 'The parade right of the main cardioid',
    view: { centerX: 0.2825, centerY: 0.01, scale: 1.5e-3 },
    morph: 0,
    colorMode: 'smooth',
    palette: 1,
    density: 1.8,
  },
  {
    id: 'triple-spiral',
    label: 'Triple Spiral',
    hint: 'Threefold spirals on the upper bulb',
    view: { centerX: -0.08845, centerY: 0.6548, scale: 8e-4 },
    morph: 0,
    colorMode: 'distance',
    palette: 0,
    density: 1.8,
  },
  {
    id: 'misiurewicz',
    label: 'Misiurewicz Spiral',
    hint: 'Self similar spiral around a pre-periodic point',
    view: { centerX: -0.77568377, centerY: 0.13646737, scale: 1.2e-6 },
    morph: 0,
    colorMode: 'smooth',
    palette: 3,
    density: 1.8,
  },
  {
    id: 'mini-mandelbrot',
    label: 'Mini Mandelbrot',
    hint: 'A satellite copy sitting on the antenna',
    view: { centerX: -1.749081, centerY: 0, scale: 8e-6 },
    morph: 0,
    colorMode: 'distance',
    palette: 5,
    density: 1.8,
  },
  {
    id: 'julia-island',
    label: 'Julia Island',
    hint: '2.5 billion times - emulated 64 bit precision',
    view: {
      centerX: -0.7746806106269039,
      centerY: -0.1374168856037867,
      scale: 5e-10,
    },
    morph: 0,
    colorMode: 'smooth',
    palette: 2,
    density: 1.8,
  },
  {
    id: 'seahorse-deep',
    label: 'Seahorse Deep',
    hint: '25 billion times - the deepest landmark',
    view: {
      centerX: -0.7436438870371587,
      centerY: 0.13182590420531198,
      scale: 5e-11,
    },
    morph: 0,
    colorMode: 'smooth',
    palette: 2,
    density: 1.8,
  },
  {
    id: 'julia-dendrite',
    label: 'Julia: Dendrite',
    hint: 'c = i, a Julia set without interior',
    view: { centerX: 0, centerY: 0, scale: 1.5 },
    morph: 1,
    juliaC: { x: 0, y: 1 },
    colorMode: 'distance',
    palette: 3,
    density: 1.8,
  },
  {
    id: 'julia-rabbit',
    label: "Julia: Douady's Rabbit",
    hint: 'c = -0.123 + 0.745i',
    view: { centerX: 0, centerY: 0, scale: 1.3 },
    morph: 1,
    juliaC: { x: -0.123, y: 0.745 },
    colorMode: 'distance',
    palette: 2,
    density: 1.8,
  },
  {
    id: 'julia-siegel',
    label: 'Julia: Siegel Disk',
    hint: 'c = -0.390541 - 0.586788i',
    view: { centerX: 0, centerY: 0, scale: 1.3 },
    morph: 1,
    juliaC: { x: -0.390541, y: -0.586788 },
    colorMode: 'distance',
    palette: 3,
    density: 1.8,
  },
  {
    id: 'julia-dragon',
    label: 'Julia: Dragon',
    hint: 'c = 0.285 + 0.01i, drawn with an orbit trap',
    view: { centerX: 0, centerY: 0, scale: 1.3 },
    morph: 1,
    juliaC: { x: 0.285, y: 0.01 },
    colorMode: 'trap',
    palette: 1,
    density: 1.2,
  },
];

export const DEFAULT_PRESET = FRACTAL_PRESETS[0];
