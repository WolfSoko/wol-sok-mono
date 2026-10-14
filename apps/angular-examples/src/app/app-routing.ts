import {
  Data,
  provideRouter,
  Route,
  withComponentInputBinding,
  withEnabledBlockingInitialNavigation,
  withInMemoryScrolling,
  withRouterConfig,
} from '@angular/router';
import { InfoComponent } from './feature/lazy/info/info.component';
import { loadRemoteModule } from '@angular-architects/native-federation';

export interface MainNavRouteData extends Data {
  linkText: string;
  subTitle?: string;
  /** Meta description for search engines and link previews. */
  description?: string;
}

export interface MainNavRoute extends Route {
  data: MainNavRouteData;
  path: string;
}

export type MainNavRoutes = MainNavRoute[];

export const APP_ROUTES: MainNavRoutes = [
  {
    // here we can have a thanosDemo query param to show a demo of the vaporizeAndScrollIntoView effect
    path: 'home',
    component: InfoComponent,
    data: {
      linkText: 'Home',
      description:
        'Interactive Angular showcase by Wolfram Sokollek: WebGL shaders, TensorFlow.js, gpu.js, WebAssembly, Fourier analysis, Mandelbrot deep zoom and Module Federation demos.',
    },
  },
  {
    path: 'fourierAnalysis',
    loadChildren: () =>
      loadRemoteModule<typeof import('fourier-analysis-remote/Routes')>(
        'fourier-analysis-remote',
        './Routes'
      ).then((routes) => routes.remoteRoutes),
    data: {
      linkText: 'Fourier Analysis Example',
      subTitle: 'Served independently by Module-Federation',
      description:
        'Interactive Fourier transformation explained visually: wrap a signal wave or your own microphone recording around a circle and find its frequencies.',
    },
  },
  {
    path: 'shaderExamples',
    loadChildren: () =>
      loadRemoteModule<typeof import('shader-examples-remote/Routes')>(
        'shader-examples-remote',
        './Routes'
      ).then((routes) => routes.remoteRoutes),
    data: {
      linkText: 'WebGL Shader examples with live code editor (three.js)',
      subTitle: 'Served independently by MF',
      description:
        'Write and tweak GLSL fragment shaders in a live code editor and see the result instantly, rendered with three.js and WebGL in Angular.',
    },
  },
  {
    path: 'tensorflowExamples',
    loadChildren: () =>
      import('@wolsok/feat-lazy-tf-examples').then(
        (m) => m.TENSORFLOW_EXAMPLES_ROUTES
      ),
    data: {
      linkText: 'Tensorflow examples',
      description:
        'Machine learning in the browser with TensorFlow.js: draw a digit and let a deep neural network trained on MNIST recognise it.',
    },
  },
  {
    path: 'reactionDiff',
    loadComponent: () =>
      import('@wolsok/feat-reaction-diff').then((m) => m.ReactionDiffComponent),
    data: {
      linkText: 'Reaction Diffusion Algorithm (gpu.js)',
      description:
        'GPU accelerated Gray-Scott reaction diffusion simulation with gpu.js: draw into the canvas and watch organic Turing patterns grow.',
    },
  },
  {
    path: 'poisson',
    loadChildren: () =>
      import('@wolsok/feat-lazy-poisson').then((m) => m.routes),
    data: {
      linkText: 'Poisson Distribution Algorithm',
      description:
        'Poisson disk sampling visualised: evenly distributed random circles on a plane, generated step by step from a seed point you click.',
    },
  },
  {
    path: 'bacteriaGame',
    loadChildren: () =>
      loadRemoteModule<typeof import('bacteria-game-remote/Routes')>(
        'bacteria-game-remote',
        './Routes'
      ).then((routes) => routes.entryRoutes),
    data: {
      linkText: 'Bacteria Game',
      subTitle: 'Served independently by MF',
      description:
        'Bacteria War: a browser game where bacteria colonies fight for territory, built with Angular and loaded at runtime via Native Federation.',
    },
  },
  {
    path: 'gravityWorld',
    loadChildren: () =>
      import('@wolsok/feat-lazy-gravity-rocks').then(
        (m) => m.GRAVITY_ROCKS_ROUTES
      ),
    data: {
      linkText: 'Playing around with Sun and Planets gravity',
      description:
        'Interactive gravity simulation of a sun and its planets: add bodies and watch orbits form, rendered in the browser with Angular.',
    },
  },
  {
    path: 'someGpuCalculations',
    loadChildren: () =>
      import('@wolsok/feat-lazy-some-gpu-calculation').then(
        (mod) => mod.SOME_GPU_CALCULATION_ROUTES
      ),
    data: {
      linkText: 'Some Gpu Accelerated Calculations (gpu.js)',
      description:
        'GPU accelerated rendering with gpu.js and no shader code: toggle between GPU and CPU and compare the frame rate live in the browser.',
    },
  },
  {
    path: 'webGl',
    loadChildren: () =>
      import('@wolsok/feat-lazy-web-gl').then((m) => m.routes),
    data: {
      linkText: 'Mandelbrot Deep Zoom Explorer (three.js)',
      description:
        'Explore the Mandelbrot set with a real-time deep zoom fractal renderer built on WebGL shaders and three.js.',
    },
  },
  {
    path: 'neuralNetwork',
    loadChildren: () =>
      import('@wolsok/feat-lazy-neural-networks').then((m) => m.routes),
    data: {
      linkText: 'Neural Networks (p5)',
      description:
        'Watch a perceptron and a small neural network learn in real time, with training data visualised using p5.js in Angular.',
    },
  },
  {
    path: 'performanceTests',
    loadChildren: () =>
      import('./feature/lazy/performance-test/performance-test.routes').then(
        (m) => m.routes
      ),
    data: {
      linkText: 'Performance Tests',
      description:
        'JavaScript performance comparison: generate and process arrays and streams with millions of numbers and compare the run times.',
    },
  },
  {
    path: 'webassemblyTests',
    loadChildren: () => import('@wolsok/feat-wasm-test').then((m) => m.routes),
    data: {
      linkText: 'Calculating Fibonacci with WebAssembly',
      description:
        'Compare Fibonacci calculations in plain JavaScript and WebAssembly (AssemblyScript) running side by side in an Angular app.',
    },
  },
];

const DEFAULT_APP_ROUTE = { path: '**', redirectTo: '/home' };

export const provideAppRouter = () =>
  provideRouter(
    [...APP_ROUTES, DEFAULT_APP_ROUTE],
    withRouterConfig({ paramsInheritanceStrategy: 'always' }),
    withComponentInputBinding(),
    withEnabledBlockingInitialNavigation(),
    withInMemoryScrolling({
      scrollPositionRestoration: 'enabled',
      anchorScrolling: 'enabled',
    })
  );
