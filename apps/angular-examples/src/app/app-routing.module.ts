import { NgModule } from '@angular/core';
import { Data, Route, RouterModule } from '@angular/router';
import { InfoComponent } from './info/info.component';
import { ROUTER_LINKS } from './router-links.token';

export interface MainNavRouteData extends Data {
  linkText: string;
}

export interface MainNavRoute extends Route {
  data: MainNavRouteData;
  path: string;
}

const mainNavRoutes: MainNavRoute[] = [
  { path: 'home', component: InfoComponent, data: { linkText: 'Home' } },
  {
    path: 'fourierAnalysis',
    loadChildren: () =>
      import('@wolsok/feat-fourier-analysis').then(
        (m) => m.FourierAnalysisModule
      ),
    data: { linkText: 'Fourier Analysis Example' },
  },
  {
    path: 'bacteriaGame',
    loadChildren: () =>
      import('./bacteria-game/bacteria-game.module').then(
        (m) => m.BacteriaGameModule
      ),
    data: { linkText: 'Bacteria Game' },
  },
  {
    path: 'shaderExamples',
    loadChildren: () =>
      import('@wolsok/feat-shader-examples').then(
        (m) => m.ShaderExamplesModule
      ),
    data: {
      linkText: 'WebGL Shader examples with live code editor (three.js)',
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
    loadChildren: () =>
      import('./web-gl/web-gl.module').then((m) => m.WebGlModule),
    data: { linkText: 'Mandelbrot plane, lights objects (three.js)' },
  },
  {
    path: 'tensorflowExamples',
    loadChildren: () =>
      import('./tensorflow-examples/tensorflow-examples.module').then(
        (m) => m.TensorflowExamplesModule
      ),
    data: { linkText: 'Tensorflow examples' },
  },
  {
    path: 'neuralNetwork',
    loadChildren: () =>
      import('./neural-network/neural-network.module').then(
        (m) => m.NeuralNetworkModule
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
      import('./poisson/poisson.module').then((m) => m.PoissonModule),
    data: { linkText: 'Poisson Distribution Algorithm' },
  },
  {
    path: 'performanceTests',
    loadChildren: () =>
      import('./performance-test/performance-test.module').then(
        (m) => m.PerformanceTestModule
      ),
    data: { linkText: 'Performance Tests' },
  },
  {
    path: 'webassemblyTests',
    loadChildren: () =>
      import('@wolsok/feat-wasm-test').then((m) => m.WasmTestModule),
    data: { linkText: 'Calculating Fibonacci with WebAssembly' },
  },
  {
    path: 'gravityWorld',
    loadChildren: () =>
      import('@wolsok/gravity-rocks').then((m) => m.GRAVITY_ROCKS_ROUTES),
    data: { linkText: 'Playing around with Sun and Planets gravity' },
  },
];

const defaultRoute = { path: '**', redirectTo: '/home' };

@NgModule({
  imports: [
    RouterModule.forRoot([...mainNavRoutes, defaultRoute], {
      paramsInheritanceStrategy: 'always',
    }),
  ],
  exports: [RouterModule],
  providers: [
    {
      provide: ROUTER_LINKS,
      useValue: mainNavRoutes,
    },
  ],
})
export class AppRoutingModule {}
