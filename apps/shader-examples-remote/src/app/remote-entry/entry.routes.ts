import { Route } from '@angular/router';
import { shaderExamplesRoutes } from '@wolsok/feat-shader-examples';

export const remoteRoutes: Route[] = [
  {
    path: '',
    children: shaderExamplesRoutes,
  },
];
