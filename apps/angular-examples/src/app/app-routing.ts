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

export interface MainNavRouteData extends Data {
  linkText: string;
  subTitle?: string;
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
    data: { linkText: 'Home' },
  },
  {
    path: 'fourierAnalysis',
    loadChildren: () =>
      import('fourier-analysis-remote/Routes').then(
        (routes) => routes.remoteRoutes
      ),
    data: {
      linkText: 'Fourier Analysis Example',
      subTitle: 'Served independently by Webpacks Module-Federation',
    },
  },
  {
    path: 'bacteriaGame',
    loadChildren: () =>
      import('shader-examples-remote/Routes').then(
        (routes) => routes.remoteRoutes
      ),
    data: { linkText: 'Bacteria Game', subTitle: 'Served independently by MF' },
  },
  {
    path: 'shaderExamples',
    loadChildren: () =>
      import('shader-examples-remote/Routes').then(
        (routes) => routes.remoteRoutes
      ),
    data: {
      linkText: 'WebGL Shader examples with live code editor (three.js)',
      subTitle: 'Served independently by MF',
    },
  },
  {
    path: 'someGpuCalculations',
    loadChildren: () =>
      import('@wolsok/feat-lazy-some-gpu-calculation').then(
        (mod) => mod.SOME_GPU_CALCULATION_ROUTES
      ),
    data: { linkText: 'Some Gpu Accelerated Calculations (gpu.js)' },
  },
  {
    path: 'webGl',
    loadChildren: () => import('./feature/lazy/web-gl/web-gl.routes'),
    data: { linkText: 'Mandelbrot plane, lights objects (three.js)' },
  },
  {
    path: 'tensorflowExamples',
    loadChildren: () =>
      import('@wolsok/feat-lazy-tf-examples').then(
        (m) => m.TENSORFLOW_EXAMPLES_ROUTES
      ),
    data: { linkText: 'Tensorflow examples' },
  },
  {
    path: 'neuralNetwork',
    loadChildren: () =>
      import('./feature/lazy/neural-network/neural-network-routes').then(
        (m) => m.routes
      ),
    data: { linkText: 'Neural Networks (p5)' },
  },
  {
    path: 'reactionDiff',
    loadComponent: () =>
      import('@wolsok/feat-reaction-diff').then((m) => m.ReactionDiffComponent),
    data: { linkText: 'Reaction Diffusion Algorithm (gpu.js)' },
  },
  {
    path: 'poisson',
    loadChildren: () =>
      import('@wolsok/feat-lazy-poisson').then((m) => m.routes),
    data: { linkText: 'Poisson Distribution Algorithm' },
  },
  {
    path: 'performanceTests',
    loadChildren: () =>
      import('./feature/lazy/performance-test/performance-test.routes').then(
        (m) => m.routes
      ),
    data: { linkText: 'Performance Tests' },
  },
  {
    path: 'webassemblyTests',
    loadChildren: () => import('@wolsok/feat-wasm-test').then((m) => m.routes),
    data: { linkText: 'Calculating Fibonacci with WebAssembly' },
  },
  {
    path: 'gravityWorld',
    loadChildren: () =>
      import('@wolsok/feat-lazy-gravity-rocks').then(
        (m) => m.GRAVITY_ROCKS_ROUTES
      ),
    data: { linkText: 'Playing around with Sun and Planets gravity' },
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
