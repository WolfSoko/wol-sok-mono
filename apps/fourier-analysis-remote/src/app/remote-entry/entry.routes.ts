import { Routes } from '@angular/router';

export const remoteRoutes: Routes = [
  {
    path: '',
    loadChildren: () =>
      import('@wolsok/feat-fourier-analysis').then((m) => m.routes),
  },
];
